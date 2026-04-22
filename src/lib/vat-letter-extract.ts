// ════════════════════════════════════════════════════════════════════════
// Extract structured fields from a Luxembourg VAT registration letter.
//
// Shared by:
//   - POST /api/entities/extract-vat-letter (stateless preview during
//     entity creation, before the entity id exists)
//   - POST /api/entities/[id]/official-documents (after creation;
//     persists the PDF + stores the extracted fields as JSONB so we
//     can diff them against the live entity later)
//
// Stint 15 (2026-04-20). Per Diego: "esa carta se guardara, porque
// está bien tenerla a mano para poder verificar… y también que se
// pudiese subir otra carta más tarde, porque a veces cambia la
// periodicidad".
// ════════════════════════════════════════════════════════════════════════

import Anthropic from '@anthropic-ai/sdk';
import { anthropicCreate } from '@/lib/anthropic-wrapper';
import { logger } from '@/lib/logger';

const log = logger.bind('vat-letter-extract');

export interface ExtractedVatLetterFields {
  name: string | null;
  legal_form: string | null;
  vat_number: string | null;
  matricule: string | null;
  rcs_number: string | null;
  address: string | null;
  regime: 'simplified' | 'ordinary' | null;
  frequency: 'monthly' | 'quarterly' | 'yearly' | null;
  entity_type: string | null;
  effective_date: string | null;

  // Stint 24 — fields added after benchmarking the extractor against
  // real AED production paper. All optional; the extractor returns
  // null when the field is blank on the letter.
  tax_office: string | null;             // "Luxembourg 3" / "Diekirch 1" / …
  activity_code: string | null;          // AED 2-3-letter code, e.g. "AN"
  activity_description: string | null;   // free-text, e.g. "Alternative investment fund"
  bank_name: string | null;              // Banque field on Fiche Signalétique
  bank_iban: string | null;              // normalized: no spaces, uppercase
  bank_bic: string | null;               // 8 or 11 chars, uppercase
  deregistration_date: string | null;    // Date fin d'activité, ISO YYYY-MM-DD
  document_date: string | null;          // AED issuance date, ISO YYYY-MM-DD

  warnings: string[];
}

export type VatLetterMediaType =
  | 'application/pdf'
  | 'image/jpeg'
  | 'image/png'
  | 'image/gif'
  | 'image/webp';

const SYSTEM_PROMPT = `You are reading a Luxembourg VAT registration letter
("Attestation d'immatriculation à la TVA") issued by the Administration
de l'enregistrement, des domaines et de la TVA (AED). Extract the
structured fields below. Return STRICT JSON only — no prose, no code
fences.

JSON schema:
{
  "name":                 string | null,   // entity legal name, no legal-form suffix stripped
  "legal_form":           string | null,   // "SARL" | "SA" | "SCSp" | "SCS" | "SCA" | "RAIF" | "SIF" | ...
  "vat_number":           string | null,   // "LU" + 8 digits, e.g. "LU12345678" (no space, uppercase)
  "matricule":            string | null,   // 11-13 digit LU national identifier (return normalized WITHOUT spaces)
  "rcs_number":           string | null,   // RCS Luxembourg, e.g. "B123456"
  "address":              string | null,   // Siège address, full, single line
  "regime":               "simplified" | "ordinary" | null,
  "frequency":            "monthly" | "quarterly" | "yearly" | null,
  "entity_type":          string | null,   // one of: fund, securitization_vehicle, active_holding, gp, manco, other
  "effective_date":       string | null,   // ISO "YYYY-MM-DD" — Date début d'activité
  "tax_office":           string | null,   // "Luxembourg 3" | "Diekirch 1" | "Esch 2" | …
  "activity_code":        string | null,   // AED 2-3 letter Code Activité from the Fiche Signalétique, e.g. "AN"
  "activity_description": string | null,   // free-text Activité line, e.g. "Alternative investment fund"
  "bank_name":            string | null,   // "UBS AG" / "BGL BNP Paribas" / …
  "bank_iban":            string | null,   // normalized: no spaces, uppercase
  "bank_bic":             string | null,   // 8 or 11 chars, uppercase, no spaces
  "deregistration_date":  string | null,   // ISO "YYYY-MM-DD" — Date fin d'activité (almost always null on a fresh letter)
  "document_date":        string | null,   // ISO "YYYY-MM-DD" — "Date document" stamped by AED at top of page 1
  "warnings":             string[]         // things you could not read confidently; empty array when clean
}

Rules — core correctness:
- NEVER invent a VAT number. If the letter doesn't show one clearly, set null and add a warning.
- Matricule starts "1999" or "2000+" for modern entities; if you see a number that doesn't match, return null + warning.
- If the letter is not an AED registration letter (e.g. it's an invoice), return all-null fields and a single warning "Document does not look like a VAT registration letter".
- entity_type mapping (6 canonical values only — 'passive_holding' REMOVED 2026-04-21 because a pure passive holding is not a VAT taxable person per Polysar C-60/90 and has no reason to be registered for VAT):
    * "fund", "UCITS", "UCI Part II", "SIF", "RAIF", "SICAR", "fonds d'investissement", "alternative investment fund", "AIF" → "fund"
    * "securitisation", "securitization", "véhicule de titrisation", "loi du 22 mars 2004", "compartment", "SV" with issuance of notes/securities → "securitization_vehicle"
    * "AIFM", "ManCo", "management company", "société de gestion" → "manco"
    * "general partner", "GP", "commandité" in an SCSp/SCS context → "gp"
    * "SOPARFI" with explicit services to subsidiaries (management, administration, financing-with-management) → "active_holding"
    * "SOPARFI" without clear activity — add a warning "This letter describes a passive holding which typically is not a VAT taxable person (Polysar C-60/90). Registration may be mistaken; confirm the entity actually provides taxable services before proceeding." and set entity_type to "other"
    * Everything else → "other"

Rules — OCR artifact tolerance (the AED template is scanner-based):
- Stray non-printing punctuation may appear next to tokens: ^, *, ~, ' around legitimate values. Ignore them during extraction.
- Digits may be split by whitespace: "2 4 AOÛT 2024" means "24 août 2024"; "2024 2100 841" is the matricule printed with its canonical triplet spaces. Collapse whitespace in numeric fields before returning.
- Accents and diacritics may be corrupt: "ajoutée" may render as "Routée", "d'identification" as "d'ideadficadon". Recognize the French despite these errors.
- If normalization is genuinely ambiguous, add a warning rather than inventing a value.

Rules — field-specific guidance:
- Matricule: return normalized WITHOUT the internal spaces. "2024 2100 841" → "2024210841".
- VAT number: "LU" + 8 digits, no separators. "LU 12345678" / "LU-12345678" → "LU12345678".
- Bureau d'imposition appears as "Bureau d'imposition 3" with location "Luxembourg 3" below. Return the location+number string ("Luxembourg 3", "Diekirch 1", "Esch 2").
- Type assujetti: "Assujetti simplifié" → regime: "simplified". "Assujetti ordinaire" / "Assujetti normal" → regime: "ordinary".
- Régime de Déclaration frequency: "Annuel" → "yearly". "Trimestriel" → "quarterly". "Mensuel" → "monthly".
- Code Activité: 2-3 letter code verbatim from the Fiche Signalétique (e.g. "AN", "HH", "KH", "BF"). No interpretation, no expansion.
- Bank IBAN: strip ALL whitespace, uppercase. A CH-prefixed IBAN is valid (Luxembourg entities commonly hold accounts abroad).
- Bank BIC: 8 or 11 chars, uppercase, no whitespace.
- If a field is printed but its value is blank on the form, return null. Do NOT guess from context.

Rules — three-address handling:
- The Fiche Signalétique carries three slots: Adresse standard (Siège), Adresse commerciale, Adresse d'expédition.
- In most letters only Siège is populated. When only Siège is present, return it as \`address\`.
- When multiple addresses are populated AND they differ, return Siège as \`address\` and add a warning like: "Multiple addresses on letter; Commerciale: <x>; Expédition: <y>."

Rules — date fields:
- effective_date = "Date début d'activité" in the Informations administratives block.
- deregistration_date = "Date fin d'activité". On a fresh registration this is blank → return null. On a de-registration letter it is set → return ISO.
- document_date = "Date document: DD.MM.YYYY" printed at the top of page 1. Return ISO.
- Date format on the letter is DD.MM.YYYY (Luxembourg convention). Convert to YYYY-MM-DD.
`;

export type ExtractError =
  | { code: 'no_response'; message: string }
  | { code: 'parse_failed'; message: string; raw_text?: string };

export interface ExtractOk {
  ok: true;
  fields: ExtractedVatLetterFields;
}

export interface ExtractFail {
  ok: false;
  error: ExtractError;
}

export async function extractVatLetterFields(params: {
  buffer: Buffer;
  mediaType: VatLetterMediaType;
  filename: string;
  /** Optional — threaded through anthropicCreate for cost attribution. */
  entityId?: string | null;
}): Promise<ExtractOk | ExtractFail> {
  const { buffer, mediaType, filename, entityId } = params;
  const base64 = buffer.toString('base64');

  let resp: Anthropic.Message;
  try {
    resp = await anthropicCreate(
      {
        // Upgraded 2026-04-22 Haiku → Opus 4.7 per Diego 2026-04-21:
        // the VAT registration letter extractor was "almost completely
        // wrong" on his first try. This is a once-per-entity call
        // (creating the full VAT profile: name, VAT no., matricule,
        // RCS, regime, frequency, entity_type, effective date) — high
        // stakes, low volume. Opus 4.7's OCR + reasoning accuracy on
        // LU legal documents justifies the cost for this specific path;
        // routine invoice extraction stays on Haiku.
        model: 'claude-opus-4-7',
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: [
              mediaType === 'application/pdf'
                ? ({ type: 'document',
                    source: { type: 'base64', media_type: mediaType, data: base64 } } as Anthropic.DocumentBlockParam)
                : ({ type: 'image',
                    source: { type: 'base64', media_type: mediaType, data: base64 } } as Anthropic.ImageBlockParam),
              { type: 'text', text: 'Extract the fields in the JSON schema from the system prompt. Return ONLY the JSON.' },
            ],
          },
        ],
      },
      {
        agent: 'extractor',
        label: `vat_letter:${filename}`,
        entity_id: entityId ?? undefined,
      },
    );
  } catch (err) {
    log.error('anthropic call failed', err);
    throw err;
  }

  const textBlock = resp.content.find(c => c.type === 'text') as Anthropic.TextBlock | undefined;
  if (!textBlock) {
    return { ok: false, error: { code: 'no_response', message: 'The AI returned no readable content.' } };
  }

  let parsed: ExtractedVatLetterFields;
  try {
    const raw = textBlock.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    parsed = JSON.parse(raw);
  } catch (err) {
    log.warn('JSON parse failure', { text: textBlock.text.slice(0, 500), err });
    return {
      ok: false,
      error: {
        code: 'parse_failed',
        message: 'The AI response could not be parsed. Try uploading a clearer scan / PDF.',
        raw_text: textBlock.text.slice(0, 500),
      },
    };
  }

  // Defensive normalisation: coerce unexpected shapes to null.
  const trimOrNull = (v: unknown): string | null =>
    typeof v === 'string' ? (v.trim() || null) : null;
  const isoDate = (v: unknown): string | null =>
    typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;

  const out: ExtractedVatLetterFields = {
    name: trimOrNull(parsed.name),
    legal_form: trimOrNull(parsed.legal_form),
    vat_number: typeof parsed.vat_number === 'string'
      ? parsed.vat_number.replace(/\s+/g, '').toUpperCase() || null
      : null,
    matricule: typeof parsed.matricule === 'string'
      ? parsed.matricule.replace(/\s+/g, '') || null
      : null,
    rcs_number: typeof parsed.rcs_number === 'string'
      ? parsed.rcs_number.replace(/\s+/g, '').toUpperCase() || null
      : null,
    address: trimOrNull(parsed.address),
    regime: (parsed.regime === 'simplified' || parsed.regime === 'ordinary') ? parsed.regime : null,
    frequency: (['monthly', 'quarterly', 'yearly'] as const).includes(parsed.frequency as 'monthly' | 'quarterly' | 'yearly')
      ? (parsed.frequency as 'monthly' | 'quarterly' | 'yearly')
      : null,
    entity_type: trimOrNull(parsed.entity_type),
    effective_date: isoDate(parsed.effective_date),

    // Stint 24 additions
    tax_office: trimOrNull(parsed.tax_office),
    activity_code: typeof parsed.activity_code === 'string'
      ? parsed.activity_code.trim().toUpperCase() || null
      : null,
    activity_description: trimOrNull(parsed.activity_description),
    bank_name: trimOrNull(parsed.bank_name),
    bank_iban: typeof parsed.bank_iban === 'string'
      ? parsed.bank_iban.replace(/\s+/g, '').toUpperCase() || null
      : null,
    bank_bic: typeof parsed.bank_bic === 'string'
      ? parsed.bank_bic.replace(/\s+/g, '').toUpperCase() || null
      : null,
    deregistration_date: isoDate(parsed.deregistration_date),
    document_date: isoDate(parsed.document_date),

    warnings: Array.isArray(parsed.warnings) ? parsed.warnings.filter(w => typeof w === 'string').slice(0, 10) : [],
  };

  log.info('vat letter extracted', {
    file_bytes: buffer.byteLength,
    filename,
    has_vat: !!out.vat_number,
    has_matricule: !!out.matricule,
    warning_count: out.warnings.length,
  });

  return { ok: true, fields: out };
}

export function resolveMediaType(mime: string): VatLetterMediaType | null {
  const t = mime.toLowerCase();
  if (t.startsWith('application/pdf')) return 'application/pdf';
  if (t === 'image/jpeg' || t === 'image/jpg') return 'image/jpeg';
  if (t === 'image/png') return 'image/png';
  if (t === 'image/gif') return 'image/gif';
  if (t === 'image/webp') return 'image/webp';
  return null;
}

/**
 * Map extracted fields to the entity columns they'd update.
 * Used by the diff flow when re-uploading a letter.
 *
 * Notes:
 * - `frequency` maps `yearly` → `annual` to match the existing enum
 *   stored on `entities.frequency`.
 * - `document_date` is intentionally NOT surfaced here — it's an
 *   audit-only value that stays in `entity_official_documents
 *   .extracted_fields` JSONB. Persisting it on the entity would
 *   rewrite itself every upload.
 * - The new stint-24 fields (tax_office, activity_code,
 *   activity_description, bank_name, bank_iban, bank_bic,
 *   deregistration_date) persist on entities per migration 027.
 */
export function fieldsToEntityPatch(
  fields: ExtractedVatLetterFields,
): Record<string, string | null> {
  return {
    name: fields.name,
    legal_form: fields.legal_form,
    vat_number: fields.vat_number,
    matricule: fields.matricule,
    rcs_number: fields.rcs_number,
    address: fields.address,
    entity_type: fields.entity_type,
    regime: fields.regime,
    frequency: fields.frequency === 'yearly' ? 'annual' : fields.frequency,

    // Stint 24 additions — see migration 027
    tax_office: fields.tax_office,
    activity_code: fields.activity_code,
    activity_description: fields.activity_description,
    bank_name: fields.bank_name,
    bank_iban: fields.bank_iban,
    bank_bic: fields.bank_bic,
    deregistration_date: fields.deregistration_date,
  };
}
