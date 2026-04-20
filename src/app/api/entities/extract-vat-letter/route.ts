// ════════════════════════════════════════════════════════════════════════
// POST /api/entities/extract-vat-letter
//
// Reads a Luxembourg "Attestation d'immatriculation à la TVA" PDF (the
// letter the AED sends after a successful VAT registration) and returns
// the structured fields so the New Entity form can pre-fill.
//
// Typical fields on the letter:
//   - Entity legal name + legal form
//   - VAT number (e.g. LU12345678)
//   - Matricule national (e.g. 1999220...)
//   - RCS number (e.g. B123456)
//   - Registered office address
//   - Activity description + NACE code
//   - Regime (simplified / ordinary) + filing frequency
//   - Effective date
//
// Stint 14 (2026-04-20). Per Diego's voice note: "yo te subo la VAT
// Registration Letter y tú ya absorbes de ahí toda la información
// posible".
// ════════════════════════════════════════════════════════════════════════

import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { apiError, apiOk, apiFail } from '@/lib/api-errors';
import { anthropicCreate } from '@/lib/anthropic-wrapper';
import { logger } from '@/lib/logger';
import { requireBudget } from '@/lib/budget-guard';

const log = logger.bind('entities/extract-vat-letter');

// Schema the extractor returns. Unknown / unreadable fields are null.
interface ExtractedFields {
  name: string | null;
  legal_form: string | null;   // SARL / SA / SCSp / RAIF / SIF / SICAR / …
  vat_number: string | null;   // LU-format if present
  matricule: string | null;
  rcs_number: string | null;
  address: string | null;
  regime: 'simplified' | 'ordinary' | null;
  frequency: 'monthly' | 'quarterly' | 'yearly' | null;
  entity_type: string | null;  // soparfi / fund / aifm / holding / …
  effective_date: string | null;
  warnings: string[];
}

export async function POST(request: NextRequest) {
  try {
    // Budget guard — this is an Anthropic call; respect the cap.
    const budget = await requireBudget();
    if (!budget.ok) {
      return apiError(
        'budget_exhausted',
        budget.error?.message ?? 'Anthropic monthly budget exhausted.',
        { status: 429 },
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) return apiError('file_required', 'No file attached.', { status: 400 });
    if (file.size > 20 * 1024 * 1024) {
      return apiError('file_too_large', 'Max 20 MB.', { status: 400 });
    }

    const type = file.type.toLowerCase();
    if (!type.startsWith('application/pdf') && !type.startsWith('image/')) {
      return apiError('bad_type', 'Only PDFs or images are accepted.', { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const base64 = buf.toString('base64');

    const mediaType = type.startsWith('image/')
      ? (type as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp')
      : 'application/pdf';

    const prompt = `You are reading a Luxembourg VAT registration letter
("Attestation d'immatriculation à la TVA") issued by the Administration
de l'enregistrement, des domaines et de la TVA (AED). Extract the
structured fields below. Return STRICT JSON only — no prose, no code
fences.

JSON schema:
{
  "name":            string | null,   // entity legal name, no legal-form suffix stripped
  "legal_form":      string | null,   // "SARL" | "SA" | "SCSp" | "SCA" | "RAIF" | "SIF" | ...
  "vat_number":      string | null,   // "LU" + 8 digits, e.g. "LU12345678"
  "matricule":       string | null,   // 11-13 digit LU national identifier
  "rcs_number":      string | null,   // RCS Luxembourg, e.g. "B123456"
  "address":         string | null,   // full address as printed
  "regime":          "simplified" | "ordinary" | null,
  "frequency":       "monthly" | "quarterly" | "yearly" | null,
  "entity_type":     string | null,   // one of: fund, active_holding, passive_holding, gp, manco, other
  "effective_date":  string | null,   // ISO "YYYY-MM-DD" when VAT registration becomes effective
  "warnings":        string[]         // things you could not read confidently; empty array when clean
}

Rules:
- NEVER invent a VAT number. If the letter doesn't show one clearly, set null and add a warning.
- Matricule starts "1999" or "2000+" for modern entities; if you see a number that doesn't match, return null + warning.
- If the letter is not an AED registration letter (e.g. it's an invoice), return all-null fields and a single warning "Document does not look like a VAT registration letter".
- entity_type: if the letter mentions "fund", "UCITS", "SIF", "RAIF", "SICAR" → "fund". "SOPARFI" without clear activity → "other". "AIFM" / "ManCo" → "manco".
`;

    let resp: Anthropic.Message;
    try {
      resp = await anthropicCreate(
        {
          model: 'claude-haiku-4-5',
          max_tokens: 1000,
          system: prompt,
          messages: [
            {
              role: 'user',
              content: [
                { type: mediaType === 'application/pdf' ? 'document' : 'image',
                  source: { type: 'base64', media_type: mediaType, data: base64 } } as Anthropic.DocumentBlockParam | Anthropic.ImageBlockParam,
                { type: 'text', text: 'Extract the fields in the JSON schema from the system prompt. Return ONLY the JSON.' },
              ],
            },
          ],
        },
        { agent: 'extractor', label: `vat_letter:${file.name}` },
      );
    } catch (err) {
      log.error('anthropic call failed', err);
      return apiFail(err, 'entities/extract-vat-letter');
    }

    const textBlock = resp.content.find(c => c.type === 'text') as Anthropic.TextBlock | undefined;
    if (!textBlock) {
      return apiError('no_response', 'The AI returned no readable content.', { status: 500 });
    }

    let parsed: ExtractedFields;
    try {
      // Some models wrap JSON in a code fence; strip defensively.
      const raw = textBlock.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
      parsed = JSON.parse(raw);
    } catch (err) {
      log.warn('JSON parse failure', { text: textBlock.text.slice(0, 500), err });
      return apiError(
        'analysis_parse_failed',
        'The AI response could not be parsed. Try uploading a clearer scan / PDF.',
        { status: 422 },
      );
    }

    // Defensive normalisation: coerce unexpected shapes to null before returning.
    const out: ExtractedFields = {
      name: typeof parsed.name === 'string' ? parsed.name.trim() || null : null,
      legal_form: typeof parsed.legal_form === 'string' ? parsed.legal_form.trim() || null : null,
      vat_number: typeof parsed.vat_number === 'string' ? parsed.vat_number.trim().toUpperCase() || null : null,
      matricule: typeof parsed.matricule === 'string' ? parsed.matricule.trim() || null : null,
      rcs_number: typeof parsed.rcs_number === 'string' ? parsed.rcs_number.trim().toUpperCase() || null : null,
      address: typeof parsed.address === 'string' ? parsed.address.trim() || null : null,
      regime: (parsed.regime === 'simplified' || parsed.regime === 'ordinary') ? parsed.regime : null,
      frequency: (['monthly', 'quarterly', 'yearly'] as const).includes(parsed.frequency as 'monthly' | 'quarterly' | 'yearly') ? (parsed.frequency as 'monthly' | 'quarterly' | 'yearly') : null,
      entity_type: typeof parsed.entity_type === 'string' ? parsed.entity_type.trim() || null : null,
      effective_date: typeof parsed.effective_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.effective_date) ? parsed.effective_date : null,
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings.filter(w => typeof w === 'string').slice(0, 10) : [],
    };

    log.info('vat letter extracted', {
      file_bytes: file.size,
      has_vat: !!out.vat_number, has_matricule: !!out.matricule,
      warning_count: out.warnings.length,
    });

    return apiOk({ fields: out });
  } catch (err) {
    return apiFail(err, 'entities/extract-vat-letter');
  }
}
