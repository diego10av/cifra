'use client';

// ════════════════════════════════════════════════════════════════════════
// AssessmentInlineEditor — stint 37.D
//
// Dedicated inline cell for "Assessment {year-1}" on the CIT page.
// The cell maps to the PRIOR-year filing row — when Diego changes it,
// we PATCH the year-1 filing with:
//   - tax_assessment_received_at = picked date (or null)
//   - status = 'assessment_received' (when a date is present)
//
// Display collapses to:
//   - "Received DD Mmm" green chip (when tax_assessment_received_at set)
//   - status badge + dropdown (when still awaiting)
//   - "—" when no prior-year filing exists
//
// On click → popover with status dropdown + date picker + Save/Cancel.
// ════════════════════════════════════════════════════════════════════════

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { filingStatusLabel, FILING_STATUSES } from './FilingStatusBadge';

/** Stint 44.F3 — three explicit outcome categories. */
export type AssessmentOutcome = 'aligned' | 'under_audit' | null;

interface Props {
  filingId: string | null;
  currentStatus: string | null;
  assessmentDate: string | null;
  /** Stint 44.F3 — outcome category once received. NULL = not yet
   *  categorised (legacy rows). */
  assessmentOutcome?: AssessmentOutcome;
  onSave: (args: {
    status: string;
    assessmentDate: string | null;
    assessmentOutcome: AssessmentOutcome;
  }) => Promise<void>;
}

export function AssessmentInlineEditor({
  filingId, currentStatus, assessmentDate, assessmentOutcome, onSave,
}: Props) {
  const [open, setOpen] = useState(false);
  const [draftStatus, setDraftStatus] = useState(currentStatus ?? 'info_to_request');
  const [draftDate, setDraftDate] = useState(assessmentDate ?? '');
  const [draftOutcome, setDraftOutcome] = useState<AssessmentOutcome>(assessmentOutcome ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Stint 64.V.6 — popover portaled to <body> so the table's sticky
  // cells can't visually clip / overlap it. Same pattern as
  // EntityActionsMenu + LiquidationChip (stint 64.V.5).
  const [popupPos, setPopupPos] = useState<{ left: number; top: number } | null>(null);
  const recomputePos = useCallback(() => {
    const t = triggerRef.current;
    if (!t) return;
    const r = t.getBoundingClientRect();
    setPopupPos({ left: r.left, top: r.bottom + 4 });
  }, []);

  useEffect(() => {
    if (open) {
      setDraftStatus(currentStatus ?? 'info_to_request');
      setDraftDate(assessmentDate ?? '');
      setDraftOutcome(assessmentOutcome ?? null);
      setError(null);
    }
  }, [open, currentStatus, assessmentDate, assessmentOutcome]);

  // Click-outside = save + close. Now checks both the wrapper (trigger)
  // and the portaled popover, since they live in different React trees.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (wrapperRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      void commit();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, draftStatus, draftDate, draftOutcome]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  // Track popup position so it follows scroll/resize. capture=true so
  // we catch scroll on inner overflow:auto ancestors (the matrix
  // viewport) too.
  useEffect(() => {
    if (!open) { setPopupPos(null); return; }
    recomputePos();
    const onScroll = () => recomputePos();
    const onResize = () => recomputePos();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open, recomputePos]);

  async function commit() {
    if (busy) return;
    // Auto-clear outcome if the date is being cleared (outcome only
    // makes sense when there's a received date).
    const effectiveOutcome: AssessmentOutcome = draftDate === '' ? null : draftOutcome;
    // No-op if nothing changed
    if (
      draftStatus === (currentStatus ?? '')
      && draftDate === (assessmentDate ?? '')
      && effectiveOutcome === (assessmentOutcome ?? null)
    ) {
      setOpen(false);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSave({
        status: draftStatus,
        assessmentDate: draftDate === '' ? null : draftDate,
        assessmentOutcome: effectiveOutcome,
      });
      setOpen(false);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  }

  // Display node
  if (!filingId) {
    return <span className="text-ink-faint italic text-xs">No prior filing</span>;
  }

  // Stint 44.F3 — pragmatic tri-state restored, this time with a real
  // outcome category instead of overloading the status enum. Three chips:
  //   - no date              → "Not yet" amber
  //   - date + aligned       → "✓ Aligned · DATE" green
  //   - date + under_audit   → "⚠ Under audit · DATE" orange
  //   - date + null outcome  → legacy "✓ Received · DATE" gray-green
  //                            (entries created before mig 062 don't have
  //                            an outcome; preserved verbatim)
  let triStateChip: React.ReactNode;
  if (!assessmentDate) {
    triStateChip = (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-2xs bg-amber-100 text-amber-800">
        Not yet
      </span>
    );
  } else if (assessmentOutcome === 'aligned') {
    triStateChip = (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-2xs bg-green-100 text-green-800">
        ✓ Aligned · {assessmentDate}
      </span>
    );
  } else if (assessmentOutcome === 'under_audit') {
    triStateChip = (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-2xs bg-orange-100 text-orange-800">
        ⚠ Under audit · {assessmentDate}
      </span>
    );
  } else {
    // Legacy row: date set, outcome NULL. Soft "received" chip nudges
    // Diego to categorise on next click without screaming.
    triStateChip = (
      <span
        className="inline-flex items-center px-1.5 py-0.5 rounded-full text-2xs bg-emerald-50 text-emerald-700 border border-emerald-200"
        title="Received but outcome not categorised — click to mark Aligned or Under audit"
      >
        ✓ Received · {assessmentDate}
      </span>
    );
  }

  const displayNode = triStateChip;

  // Stint 64.V.6 — popover JSX rendered to body via portal so it
  // can't be visually clipped by the matrix's sticky cells. Clamp
  // to viewport so a click near the right/bottom edge doesn't
  // render off-screen.
  const W = 240;
  const H = 240;
  const popupNode = open && popupPos && typeof document !== 'undefined'
    ? createPortal(
        <div
          ref={popoverRef}
          className="fixed z-popover bg-surface border border-border rounded-md shadow-lg p-2 space-y-1.5 min-w-[220px]"
          style={{
            left: Math.min(popupPos.left, (typeof window !== 'undefined' ? window.innerWidth  : 1200) - W - 4),
            top:  Math.min(popupPos.top,  (typeof window !== 'undefined' ? window.innerHeight : 800)  - H - 4),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <label className="block text-2xs text-ink-muted">Status</label>
          <select
            autoFocus
            value={draftStatus}
            onChange={(e) => setDraftStatus(e.target.value)}
            className="w-full px-1.5 py-0.5 text-xs border border-border rounded bg-surface"
          >
            {FILING_STATUSES.map(s => (
              <option key={s} value={s}>{filingStatusLabel(s)}</option>
            ))}
          </select>
          <label className="block text-2xs text-ink-muted mt-1">Assessment date</label>
          <input
            type="date"
            value={draftDate}
            onChange={(e) => setDraftDate(e.target.value)}
            className="w-full px-1.5 py-0.5 text-xs border border-border rounded bg-surface tabular-nums"
          />
          {draftDate && (
            <>
              <label className="block text-2xs text-ink-muted mt-1">Outcome</label>
              <div className="flex flex-col gap-0.5">
                <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer">
                  <input
                    type="radio"
                    name="assessment-outcome"
                    checked={draftOutcome === 'aligned'}
                    onChange={() => setDraftOutcome('aligned')}
                  />
                  <span>✓ Aligned (matches our return)</span>
                </label>
                <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer">
                  <input
                    type="radio"
                    name="assessment-outcome"
                    checked={draftOutcome === 'under_audit'}
                    onChange={() => setDraftOutcome('under_audit')}
                  />
                  <span>⚠ Under audit / clarifications</span>
                </label>
                <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer text-ink-muted">
                  <input
                    type="radio"
                    name="assessment-outcome"
                    checked={draftOutcome === null}
                    onChange={() => setDraftOutcome(null)}
                  />
                  <span>Not categorised yet</span>
                </label>
              </div>
            </>
          )}
          <div className="flex gap-1 pt-1">
            <button
              type="button"
              onClick={commit}
              disabled={busy}
              className="flex-1 px-2 py-0.5 text-xs rounded bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={busy}
              className="px-2 py-0.5 text-xs rounded border border-border hover:bg-surface-alt"
            >
              Cancel
            </button>
          </div>
          {error && <div className="text-2xs text-danger-700">{error}</div>}
        </div>,
        document.body,
      )
    : null;

  return (
    <span ref={wrapperRef} className="inline-block">
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(o => !o); }}
        className="inline-block text-left hover:bg-brand-50/50 rounded px-0.5 cursor-text"
        title="Click to edit assessment status + date"
      >
        {displayNode}
      </button>
      {popupNode}
    </span>
  );
}
