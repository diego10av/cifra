import { NextRequest } from 'next/server';
import { query, queryOne, execute, generateId, logAudit, initializeSchema, tx, oneTx, execTx, logAuditTx } from '@/lib/db';
import { createClient } from '@supabase/supabase-js';
import type Anthropic from '@anthropic-ai/sdk';
import { readFile } from 'fs/promises';
import path from 'path';
import { classifyDeclaration } from '@/lib/classify';
import { anthropicCreate, maskKey } from '@/lib/anthropic-wrapper';
import { createJob, updateJob, finishJob, isCancelRequested } from '@/lib/jobs';
import { apiError, apiOk, apiFail } from '@/lib/api-errors';

const HAIKU_MODEL = 'claude-haiku-4-5-20251001';
export const maxDuration = 300;

const INTER_CALL_DELAY_MS = 500;
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function readPromptFile(name: string): Promise<string> {
  const promptPath = path.join(process.cwd(), 'prompts', name);
  return readFile(promptPath, 'utf-8');
}

// POST /api/agents/extract
// Body: { declaration_id }
// Returns: { job_id, documents_claimed, message }  (immediately, 202-style)
// The caller then polls GET /api/jobs/:id to see progress.
export async function POST(request: NextRequest) {
  try {
    await initializeSchema();
    const { declaration_id } = await request.json();

    const declaration = await queryOne<{ entity_id: string; entity_name: string; vat_number: string | null; regime: string }>(
      `SELECT d.entity_id, e.name as entity_name, e.vat_number, e.regime
         FROM declarations d JOIN entities e ON d.entity_id = e.id WHERE d.id = $1`,
      [declaration_id]
    );
    if (!declaration) return apiError('declaration_not_found', 'Declaration not found.', { status: 404 });

    // Atomic claim
    const MAX_BATCH_SIZE = 200;
    const documents = await query<{ id: string; filename: string; file_path: string; file_type: string; triage_result: string | null; triage_confidence: number | null }>(
      `UPDATE documents
         SET status = 'triaging', error_message = NULL
       WHERE id IN (
         SELECT id FROM documents
          WHERE declaration_id = $1
            AND status IN ('uploaded','error')
          LIMIT $2
       )
       RETURNING *`,
      [declaration_id, MAX_BATCH_SIZE]
    );

    if (documents.length === 0) {
      return apiOk({ message: 'No documents to process', job_id: null, documents_claimed: 0 });
    }

    // Create a job and run extraction synchronously (Vercel doesn't support
    // true background jobs without a queue — the request stays open for up to
    // maxDuration and the client polls the job record).
    const jobId = await createJob({ kind: 'extract', declaration_id, total: documents.length });

    console.log(`[extract] job=${jobId} starting for decl=${declaration_id}, docs=${documents.length}, key=${maskKey(process.env.ANTHROPIC_API_KEY)}`);

    // Fire and continue — but we must await for Vercel to keep the function running.
    const run = runExtraction({
      jobId,
      declaration_id,
      entity_id: declaration.entity_id,
      entity_name: declaration.entity_name,
      vat_number: declaration.vat_number || '',
      regime: declaration.regime,
      documents,
    });

    await run;
    return apiOk({ job_id: jobId, documents_claimed: documents.length });
  } catch (e) {
    return apiFail(e, 'agents/extract');
  }
}

async function runExtraction(params: {
  jobId: string;
  declaration_id: string;
  entity_id: string;
  entity_name: string;
  vat_number: string;
  regime: string;
  documents: Array<{ id: string; filename: string; file_path: string; file_type: string; triage_result: string | null; triage_confidence: number | null }>;
}) {
  const { jobId, declaration_id, documents, entity_id } = params;
  let triagePrompt: string, extractPrompt: string;
  try {
    triagePrompt = await readPromptFile('triage.md');
    extractPrompt = await readPromptFile('extractor.md');
  } catch {
    await finishJob(jobId, 'error', null, 'Agent prompt files not found on the server.');
    return;
  }

  const supabase = getSupabase();
  let processed = 0;
  let extractedCount = 0;
  let rejectedCount = 0;
  let errorCount = 0;

  for (let docIndex = 0; docIndex < documents.length; docIndex++) {
    const doc = documents[docIndex];

    // Cancel check
    if (await isCancelRequested(jobId)) {
      // Reset claimed-but-not-yet-touched docs back to 'uploaded'
      for (let j = docIndex; j < documents.length; j++) {
        await execute("UPDATE documents SET status = 'uploaded' WHERE id = $1 AND status = 'triaging'", [documents[j].id]);
      }
      await finishJob(jobId, 'cancelled', `Cancelled after ${processed} of ${documents.length} documents.`);
      return;
    }

    await updateJob(jobId, {
      processed,
      current_item: doc.filename,
      message: `Processing ${doc.filename}…`,
    });

    try {
      const { data: fileData, error: dlError } = await supabase.storage
        .from('documents')
        .download(doc.file_path as string);
      if (dlError || !fileData) throw new Error(`Failed to download: ${dlError?.message || 'no data'}`);
      const buffer = Buffer.from(await fileData.arrayBuffer());
      const base64 = buffer.toString('base64');
      const fileType = doc.file_type;

      let mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' | 'application/pdf';
      if (fileType === 'pdf') mediaType = 'application/pdf';
      else if (fileType === 'image') {
        const ext = doc.filename.toLowerCase().split('.').pop();
        mediaType = ext === 'png' ? 'image/png' : 'image/jpeg';
      } else {
        await execute("UPDATE documents SET status = 'triaged', triage_result = 'invoice', triage_confidence = 0.5 WHERE id = $1", [doc.id]);
        processed += 1;
        continue;
      }

      // Triage
      let triageType: string;
      let triageConfidence: number;
      if (doc.triage_result && Number(doc.triage_confidence) >= 1.0) {
        triageType = doc.triage_result;
        triageConfidence = Number(doc.triage_confidence);
      } else {
        if (docIndex > 0) await sleep(INTER_CALL_DELAY_MS);
        const triageResponse = await anthropicCreate({
          model: HAIKU_MODEL, max_tokens: 500, system: triagePrompt,
          messages: [{
            role: 'user',
            content: [
              { type: fileType === 'pdf' ? 'document' : 'image', source: { type: 'base64', media_type: mediaType, data: base64 } } as Anthropic.DocumentBlockParam | Anthropic.ImageBlockParam,
              { type: 'text', text: `Entity: ${params.entity_name} (VAT: ${params.vat_number})\nClassify this document.` },
            ],
          }],
        }, { agent: 'triage', declaration_id, entity_id, label: doc.filename });

        const triageText = triageResponse.content.find(b => b.type === 'text')?.text || '';
        let r: { type?: string; confidence?: number };
        try { r = JSON.parse(triageText); }
        catch {
          const m = triageText.match(/\{[\s\S]*?\}/);
          r = m ? JSON.parse(m[0]) : { type: 'invoice', confidence: 0.5 };
        }
        triageType = r.type || 'invoice';
        triageConfidence = r.confidence || 0.5;
      }

      await execute(
        "UPDATE documents SET status = 'triaged', triage_result = $1, triage_confidence = $2 WHERE id = $3",
        [triageType, triageConfidence, doc.id]
      );
      await logAudit({
        entityId: entity_id, declarationId: declaration_id,
        action: 'triage', targetType: 'document', targetId: doc.id,
        newValue: JSON.stringify({ type: triageType, confidence: triageConfidence }),
      });

      if (triageType === 'invoice' || triageType === 'credit_note') {
        await execute("UPDATE documents SET status = 'extracting' WHERE id = $1", [doc.id]);
        await sleep(INTER_CALL_DELAY_MS);

        const extractResponse = await anthropicCreate({
          model: HAIKU_MODEL, max_tokens: 2000, system: extractPrompt,
          messages: [{
            role: 'user',
            content: [
              { type: fileType === 'pdf' ? 'document' : 'image', source: { type: 'base64', media_type: mediaType, data: base64 } } as Anthropic.DocumentBlockParam | Anthropic.ImageBlockParam,
              { type: 'text', text: `Entity name: ${params.entity_name}\nEntity VAT number: ${params.vat_number ?? 'unknown'}\nRegime: ${params.regime}\n\nExtract all invoice data as instructed.` },
            ],
          }],
        }, { agent: 'extractor', declaration_id, entity_id, label: doc.filename });

        const extractText = extractResponse.content.find(b => b.type === 'text')?.text || '';
        let invoiceData: Record<string, unknown>;
        try { invoiceData = JSON.parse(extractText); }
        catch {
          const m = extractText.match(/\{[\s\S]*\}/);
          invoiceData = m ? JSON.parse(m[0]) : {};
        }

        // Refusal path: if the extractor signals it could not read the
        // document reliably, record an error and skip. Never emit
        // placeholder zeros / 'Unknown' / 'LU' defaults to the DB.
        if (invoiceData.extraction_failed === true) {
          await execute(
            "UPDATE documents SET status = 'error', error_message = $1 WHERE id = $2",
            [`Extractor refused: ${String(invoiceData.refusal_reason || 'no reason given')}`, doc.id]
          );
          errorCount += 1;
          continue;
        }

        // Build line records with null propagation. Prior versions defaulted
        // missing amounts to 0, country to 'LU', and provider to 'Unknown',
        // which produced silent data corruption in the VAT return.
        const lines: Array<Record<string, unknown>> = Array.isArray(invoiceData.lines) && (invoiceData.lines as unknown[]).length > 0
          ? (invoiceData.lines as Array<Record<string, unknown>>)
          : [{
              description: invoiceData.provider ?? null,
              amount_eur: invoiceData.total_ex_vat ?? null,
              vat_rate: invoiceData.total_vat != null && invoiceData.total_ex_vat != null && Number(invoiceData.total_ex_vat) > 0
                ? Number(invoiceData.total_vat) / Number(invoiceData.total_ex_vat) : null,
              vat_applied: invoiceData.total_vat ?? null,
              rc_amount: null,
              amount_incl: invoiceData.total_incl_vat ?? invoiceData.total_ex_vat ?? null,
              is_credit_note: invoiceData.is_credit_note ?? false,
              is_disbursement: false,
              exemption_reference: null,
            }];

        // ════════════ Transactional invoice + lines write ════════════
        // Creating the invoice and its lines, clearing old lines on re-extract,
        // updating the document status, and logging audit must all commit or
        // roll back together. A crash between DELETE and INSERT previously
        // left orphan invoices with zero lines — silently producing EUR 0 in
        // every eCDF box.
        const invoiceIdFromTx: string = await tx(async (txSql) => {
          const existing = await oneTx<{ id: string }>(
            txSql, 'SELECT id FROM invoices WHERE document_id = $1 LIMIT 1', [doc.id]
          );
          let invoiceId: string;
          if (existing) {
            invoiceId = existing.id;
            await execTx(txSql, 'DELETE FROM invoice_lines WHERE invoice_id = $1', [invoiceId]);
            await execTx(txSql,
              `UPDATE invoices
                 SET provider = $1, provider_vat = $2, country = $3, invoice_date = $4,
                     invoice_number = $5, direction = $6, total_ex_vat = $7, total_vat = $8,
                     total_incl_vat = $9, currency = $10, currency_amount = $11
               WHERE id = $12`,
              [
                invoiceData.provider ?? null, invoiceData.provider_vat ?? null,
                invoiceData.country ?? invoiceData.provider_country ?? null,
                invoiceData.invoice_date ?? null,
                invoiceData.invoice_number ?? null,
                invoiceData.direction ?? 'incoming',
                invoiceData.total_ex_vat ?? null, invoiceData.total_vat ?? null,
                invoiceData.total_incl_vat ?? null,
                invoiceData.currency ?? null, invoiceData.currency_amount ?? null,
                invoiceId,
              ]
            );
          } else {
            invoiceId = generateId();
            await execTx(txSql,
              `INSERT INTO invoices (id, document_id, declaration_id, provider, provider_vat, country,
                invoice_date, invoice_number, direction, total_ex_vat, total_vat, total_incl_vat,
                currency, currency_amount, extraction_source)
              VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'ai')
              ON CONFLICT (document_id) WHERE document_id IS NOT NULL DO NOTHING`,
              [
                invoiceId, doc.id, declaration_id,
                invoiceData.provider ?? null, invoiceData.provider_vat ?? null,
                invoiceData.country ?? invoiceData.provider_country ?? null,
                invoiceData.invoice_date ?? null,
                invoiceData.invoice_number ?? null,
                invoiceData.direction ?? 'incoming',
                invoiceData.total_ex_vat ?? null, invoiceData.total_vat ?? null,
                invoiceData.total_incl_vat ?? null,
                invoiceData.currency ?? null, invoiceData.currency_amount ?? null,
              ]
            );
          }
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            await execTx(txSql,
              `INSERT INTO invoice_lines (id, invoice_id, declaration_id, description, amount_eur,
                vat_rate, vat_applied, rc_amount, amount_incl, sort_order, state)
              VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'extracted')`,
              [
                generateId(), invoiceId, declaration_id,
                line.description ?? null,
                line.amount_eur ?? null,
                line.vat_rate ?? null,
                line.vat_applied ?? null,
                line.rc_amount ?? null,
                line.amount_incl ?? null,
                i,
              ]
            );
          }
          await execTx(txSql, "UPDATE documents SET status = 'extracted' WHERE id = $1", [doc.id]);
          await logAuditTx(txSql, {
            entityId: entity_id, declarationId: declaration_id,
            action: 'extract', targetType: 'invoice', targetId: invoiceId,
            newValue: JSON.stringify({ provider: invoiceData.provider, lines: lines.length }),
          });
          return invoiceId;
        });
        void invoiceIdFromTx;
        extractedCount += 1;
      } else {
        await execute("UPDATE documents SET status = 'rejected' WHERE id = $1", [doc.id]);
        rejectedCount += 1;
      }
    } catch (error) {
      console.error(`[extract] ERROR processing ${doc.filename} (id=${doc.id}):`, error);
      let errMsg = 'Unknown error';
      const err = error as { status?: number; message?: string; stack?: string };
      if (err.status === 401) errMsg = `Anthropic API 401: invalid x-api-key (check ANTHROPIC_API_KEY)`;
      else if (err.message) errMsg = err.message;
      await execute("UPDATE documents SET status = 'error', error_message = $1 WHERE id = $2", [errMsg, doc.id]);
      errorCount += 1;
    }

    processed += 1;
  }

  // Run classification
  let classificationSummary: Record<string, unknown> | null = null;
  try {
    classificationSummary = await classifyDeclaration(declaration_id) as unknown as Record<string, unknown>;
  } catch (e) {
    console.error('[extract] classification failed:', e);
  }

  // Move declaration forward
  const allDocs = await query<{ status: string }>("SELECT status FROM documents WHERE declaration_id = $1", [declaration_id]);
  if (allDocs.some(d => d.status === 'extracted')) {
    await execute("UPDATE declarations SET status = 'review', updated_at = NOW() WHERE id = $1", [declaration_id]);
  }

  const summary = `Done. ${extractedCount} extracted · ${rejectedCount} excluded · ${errorCount} failed.`;
  await updateJob(jobId, { processed, current_item: null, message: summary });
  await finishJob(jobId, 'done', JSON.stringify({ extracted: extractedCount, rejected: rejectedCount, errors: errorCount, classification: classificationSummary }));
}
