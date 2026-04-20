'use client';

// ════════════════════════════════════════════════════════════════════════
// TreatmentBadge — the coloured pill on each invoice line showing its
// classification (LUX_17, RC_EU_17, EXEMPT_44, etc.).
//
// Stint 12 (2026-04-19): upgraded from plain `title=""` tooltip to
// a rich hover popover surfacing the FULL legal trail: which rule
// fired, the classifier's reason string (with CJEU / LTVA
// references picked out), any flag reason, and the classification
// source. This is the "make the moat visible" ask from Diego's
// Gassner-audit debrief (item #8).
//
// Used inside TableRow in page.tsx; kept as a standalone import so
// a UI pass could restyle every pill in one place without touching
// the page orchestrator.
// ════════════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { TREATMENT_CODES, type TreatmentCode } from '@/config/treatment-codes';
import { treatmentColorClass } from './_helpers';

export function TreatmentBadge({
  treatment, source, rule, flagReason, reason,
}: {
  treatment: string | null;
  source: string | null;
  rule: string | null;
  flagReason: string | null;
  /** The classifier's human reason string. Surfaced in the rich
   *  popover; highlights CJEU cases + LTVA articles + AED circulars. */
  reason?: string | null;
}) {
  const [open, setOpen] = useState(false);

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

  return (
    <span className="relative inline-block">
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide cursor-help ${colors}`}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        tabIndex={0}
      >
        {treatment}
      </span>

      {open && (
        <span
          role="tooltip"
          className="absolute z-30 left-0 top-full mt-1 min-w-[320px] max-w-[440px] bg-ink text-white text-[11px] leading-snug rounded-md shadow-lg p-3 pointer-events-none"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
        >
          {/* Header: code + direction badge */}
          <div className="flex items-baseline gap-2 mb-2">
            <span className="font-mono font-semibold text-[12px] text-brand-200">
              {treatment}
            </span>
            {spec?.direction && (
              <span className="text-[9.5px] uppercase tracking-wide text-white/50">
                {spec.direction}
              </span>
            )}
          </div>

          {spec?.label && (
            <div className="font-medium text-white mb-1.5">{spec.label}</div>
          )}

          {spec?.description && (
            <div className="text-white/75 mb-2">{spec.description}</div>
          )}

          {rule && rule !== 'NO_MATCH' && (
            <div className="flex items-baseline gap-1.5 mb-2 pb-2 border-b border-white/10">
              <span className="text-[9.5px] uppercase tracking-wide text-white/40 shrink-0">
                Rule
              </span>
              <span className="font-mono font-semibold text-brand-200 text-[10.5px]">
                {rule}
              </span>
              {source && (
                <span className="text-[9.5px] uppercase tracking-wide text-white/40 ml-auto">
                  {ruleSourceLabel(rule, source)}
                </span>
              )}
            </div>
          )}

          {reason && (
            <div className="mb-2">
              <div className="text-[9.5px] uppercase tracking-wide text-white/40 mb-0.5">
                Reason
              </div>
              <p className="text-white/90">
                {highlightLegalRefs(reason)}
              </p>
            </div>
          )}

          {flagReason && (
            <div className="bg-amber-500/20 border-l-2 border-amber-400 px-2 py-1.5 rounded-r">
              <div className="text-[9.5px] uppercase tracking-wide text-amber-200 mb-0.5 flex items-center gap-1">
                <span aria-hidden>⚠</span> Reviewer note
              </div>
              <p className="text-amber-100">{flagReason}</p>
            </div>
          )}

          {!reason && !flagReason && !rule && (
            <div className="text-white/60 italic">No classification context.</div>
          )}
        </span>
      )}
    </span>
  );
}

// ─────────────────── Rule-source label ───────────────────

function ruleSourceLabel(rule: string, source: string): string {
  if (source === 'manual') return 'manual override';
  if (source === 'precedent') return 'prior-year precedent';
  if (source === 'inference') return 'inferred (may need review)';
  if (rule === 'PRECEDENT') return 'prior-year precedent';
  if (rule?.startsWith('INFERENCE')) return 'inferred';
  return 'deterministic rule';
}

// ─────────────────── Legal-ref highlighter ───────────────────
// Pulls out LTVA / Directive / CJEU case citations from the reason
// string and renders them as inline pills so the reviewer's eye
// jumps straight to the legal anchor. No link-out (yet) — just
// visual emphasis. A future pass can hyperlink each to the
// /legal-watch detail.

const LEGAL_REF_PATTERNS: RegExp[] = [
  // LTVA articles: "Art. 44§1 d LTVA", "Art. 17§1", "Article 44, paragraphe 1er, lettre d"
  /\bArt\.?\s*\d+(?:§\d+|\s*§\s*\d+|(?:\s*bis|\s*ter)?)?(?:\s*[a-z])?\s*(?:LTVA)?/gi,
  // Directive articles: "Art. 135(1)(g) Directive"
  /\bArt\.?\s*\d+\(\d+\)\(?[a-z]?\)?\s*(?:Directive)?/gi,
  // CJEU cases: "CJEU C-231/19", "C-60/90", "T-657/24", "(C-288/22)"
  /\b(?:CJEU\s*)?[CT]-\d+\/\d+\b/g,
  // Circular refs: "Circ. 764", "Circulaire 723bis"
  /\bCirc\.?\s*\d+[a-z]*(?:bis|ter)?\b/gi,
];

function highlightLegalRefs(text: string): React.ReactNode {
  const spans: Array<{ start: number; end: number }> = [];
  for (const p of LEGAL_REF_PATTERNS) {
    p.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = p.exec(text)) !== null) {
      if (m[0].trim().length > 2) {
        spans.push({ start: m.index, end: m.index + m[0].length });
      }
    }
  }
  if (spans.length === 0) return text;

  spans.sort((a, b) => a.start - b.start);
  // Merge overlapping spans.
  const merged: typeof spans = [];
  for (const s of spans) {
    const last = merged[merged.length - 1];
    if (last && s.start <= last.end) {
      last.end = Math.max(last.end, s.end);
    } else {
      merged.push({ ...s });
    }
  }

  const out: React.ReactNode[] = [];
  let cursor = 0;
  merged.forEach((s, i) => {
    if (s.start > cursor) out.push(text.slice(cursor, s.start));
    out.push(
      <span
        key={`ref-${i}-${s.start}`}
        className="inline-flex items-center px-1 rounded bg-brand-400/30 text-white font-mono text-[10px]"
      >
        {text.slice(s.start, s.end)}
      </span>,
    );
    cursor = s.end;
  });
  if (cursor < text.length) out.push(text.slice(cursor));
  return out;
}
