'use client';

// ════════════════════════════════════════════════════════════════════════
// TreatmentBadge — the coloured pill on each invoice line showing its
// classification (LUX_17, RC_EU_17, EXEMPT_44, etc.).
//
// Dumb component: takes the four classification facts (treatment code,
// source, rule, flag reason) and renders a tooltip-backed pill.
// Used inside TableRow in page.tsx; kept as a standalone import so a
// UI pass could restyle every pill in one place without touching the
// page orchestrator.
// ════════════════════════════════════════════════════════════════════════

import { TREATMENT_CODES, type TreatmentCode } from '@/config/treatment-codes';
import { treatmentColorClass } from './_helpers';

export function TreatmentBadge({
  treatment, source, rule, flagReason,
}: {
  treatment: string | null;
  source: string | null;
  rule: string | null;
  flagReason: string | null;
}) {
  if (!treatment) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-700 border border-red-200 tracking-wide">
        UNCLASSIFIED
      </span>
    );
  }

  const code = treatment as TreatmentCode;
  const spec = TREATMENT_CODES[code];
  const colors = treatmentColorClass(code, source);

  const labelParts: string[] = [];
  if (rule === 'PRECEDENT') labelParts.push('Precedent match (prior year)');
  else if (rule?.startsWith('INFERENCE')) labelParts.push(`${rule} — proposed`);
  else if (rule && rule !== 'NO_MATCH') labelParts.push(`Classified by ${rule}`);
  if (spec?.label) labelParts.push(spec.label);
  if (source) labelParts.push(`source: ${source}`);
  if (flagReason) labelParts.push(`⚠ ${flagReason}`);
  const tooltip = labelParts.join(' • ');

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide ${colors}`}
      title={tooltip}
    >
      {treatment}
    </span>
  );
}
