'use client';

// ════════════════════════════════════════════════════════════════════════
// VatLetterUpload — upload the AED VAT-registration letter, extract via
// Haiku, return the structured fields for the caller to apply to its
// form state.
//
// Stint 14 (2026-04-20). Per Diego: "yo te subo la VAT Registration
// Letter y tú ya absorbes de ahí toda la información posible, y lo que
// quede manual ya lo meto yo".
// ════════════════════════════════════════════════════════════════════════

import { useRef, useState } from 'react';
import { UploadCloudIcon, SparklesIcon, Loader2Icon, AlertTriangleIcon } from 'lucide-react';

export interface ExtractedVatLetter {
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
  warnings: string[];
}

export function VatLetterUpload({
  onExtracted,
  compact,
}: {
  onExtracted: (fields: ExtractedVatLetter) => void;
  /** When true, render as a slim inline button (for use inside a form header). */
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [preview, setPreview] = useState<ExtractedVatLetter | null>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    setWarnings([]);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/entities/extract-vat-letter', {
        method: 'POST',
        body: fd,
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error?.message ?? body?.error ?? 'Extraction failed.');
        return;
      }
      const fields = body.fields as ExtractedVatLetter;
      setPreview(fields);
      setWarnings(fields.warnings ?? []);
      onExtracted(fields);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={compact ? 'inline-block' : ''}>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = '';
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className={[
          'inline-flex items-center gap-2 rounded-md font-medium transition-colors',
          compact
            ? 'h-8 px-3 text-[12px] border border-border-strong bg-surface text-ink-soft hover:text-ink hover:bg-surface-alt'
            : 'h-11 px-4 text-[13px] border border-dashed border-brand-300 bg-brand-50/40 text-brand-800 hover:bg-brand-50 hover:border-brand-400',
          busy ? 'opacity-60 cursor-not-allowed' : '',
        ].join(' ')}
      >
        {busy
          ? <Loader2Icon size={14} className="animate-spin" />
          : <SparklesIcon size={14} />}
        {busy
          ? 'Reading letter…'
          : compact
            ? 'Auto-fill from VAT letter'
            : 'Upload VAT registration letter → auto-fill'}
        {!compact && !busy && <UploadCloudIcon size={12} className="opacity-60" />}
      </button>

      {error && (
        <div className="mt-2 text-[11.5px] text-danger-700 bg-danger-50 border border-danger-200 rounded px-3 py-1.5 inline-flex items-center gap-1.5">
          <AlertTriangleIcon size={11} /> {error}
        </div>
      )}

      {preview && warnings.length === 0 && (
        <div className="mt-2 text-[11.5px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-3 py-1.5">
          Filled {countFilled(preview)} field{countFilled(preview) === 1 ? '' : 's'} from the letter.
          Review before saving — the reviewer is the final authority.
        </div>
      )}

      {warnings.length > 0 && (
        <div className="mt-2 text-[11.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-1.5">
          <div className="font-semibold inline-flex items-center gap-1.5">
            <AlertTriangleIcon size={11} /> {warnings.length} field{warnings.length === 1 ? '' : 's'} couldn&apos;t be read
          </div>
          <ul className="mt-1 ml-4 list-disc text-[10.5px]">
            {warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

function countFilled(fields: ExtractedVatLetter): number {
  let n = 0;
  if (fields.name) n++;
  if (fields.legal_form) n++;
  if (fields.vat_number) n++;
  if (fields.matricule) n++;
  if (fields.rcs_number) n++;
  if (fields.address) n++;
  if (fields.regime) n++;
  if (fields.frequency) n++;
  if (fields.entity_type) n++;
  if (fields.effective_date) n++;
  return n;
}
