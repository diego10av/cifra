'use client';

// ════════════════════════════════════════════════════════════════════════
// LiquidationChip — stint 43.D15, simplified in 44.F4
//
// Tiny SIGNAL chip — only visible on entities that have a liquidation_date
// set. Renders amber when in-progress, gray-faint when past. Click →
// popover with date picker + "Mark today" + "Clear" actions. PATCH hits
// /api/tax-ops/entities/[id].
//
// Stint 44.F4: removed the ghost "+ liquidate" button. SETTING the date
// for the first time now lives in EntityActionsMenu (the kebab `⋯` next
// to the entity name) — the matrix used to render dashed ghost buttons
// on every active entity, which Diego rightly called "demasiado evidente"
// because most entities live 10+ years before liquidating. The chip is
// still the source of truth for editing once a date exists.
// ════════════════════════════════════════════════════════════════════════

import { useState, useRef, useEffect } from 'react';
import { useToast } from '@/components/Toaster';
// Re-export pure helpers from their own module so they're testable
// without pulling this 'use client' component into the test env.
export { periodWindow, isFinalReturnPeriod } from './liquidationPeriods';
export type { PeriodWindow } from './liquidationPeriods';

interface Props {
  entityId: string;
  entityName: string;
  liquidationDate: string | null;
  /** Called after a successful PATCH so the matrix refetches. */
  onChanged: () => void;
}

export function LiquidationChip({
  entityId, entityName, liquidationDate, onChanged,
}: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string>(liquidationDate ?? '');
  const [busy, setBusy] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const toast = useToast();

  // Sync draft when prop changes (after refetch)
  useEffect(() => { setDraft(liquidationDate ?? ''); }, [liquidationDate]);

  // Click-outside to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [open]);

  async function save(nextDate: string | null) {
    setBusy(true);
    try {
      const res = await fetch(`/api/tax-ops/entities/${entityId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ liquidation_date: nextDate }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success(
        nextDate
          ? `${entityName} liquidation set to ${nextDate}`
          : `${entityName} liquidation cleared`,
      );
      onChanged();
      setOpen(false);
    } catch (e) {
      toast.error(`Save failed: ${String(e instanceof Error ? e.message : e)}`);
    } finally {
      setBusy(false);
    }
  }

  // Stint 44.F4 — chip is signal-only. No ghost mode; setting the date
  // for the first time happens in EntityActionsMenu.
  if (!liquidationDate) return null;

  const today = new Date().toISOString().slice(0, 10);
  const isPast = liquidationDate < today;
  const chipClass = isPast
    ? 'bg-surface-alt text-ink-faint border border-border'
    : 'bg-amber-100 text-amber-800 border border-amber-300';
  const chipLabel = isPast
    ? `Liquidated · ${liquidationDate}`
    : `Liquidating · ${liquidationDate.slice(5)}`;

  return (
    <span ref={wrapperRef} className="relative inline-block ml-1.5">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        disabled={busy}
        className={[
          'inline-flex items-center px-1.5 py-0 rounded text-2xs font-medium whitespace-nowrap',
          chipClass,
          'disabled:opacity-50',
        ].join(' ')}
        title={`Liquidation date: ${liquidationDate} · click to change`}
      >
        {chipLabel}
      </button>
      {open && (
        <div
          className="absolute left-0 top-full mt-1 z-popover min-w-[260px] bg-surface border border-border rounded-md shadow-lg p-2 space-y-2"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-xs font-medium text-ink">Liquidation date</div>
          <div className="text-2xs text-ink-muted">
            {entityName}
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="px-2 py-1 text-sm border border-border rounded bg-surface flex-1"
            />
            <button
              type="button"
              onClick={() => void save(draft || null)}
              disabled={busy || draft === (liquidationDate ?? '')}
              className="px-2 py-1 text-xs bg-brand-600 text-white rounded hover:bg-brand-700 disabled:opacity-50"
            >
              Save
            </button>
          </div>
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => void save(today)}
              disabled={busy}
              className="text-xs text-brand-700 hover:underline disabled:opacity-50"
            >
              Mark today ({today})
            </button>
            {liquidationDate && (
              <button
                type="button"
                onClick={() => {
                  if (!window.confirm(`Clear liquidation date for ${entityName}? The entity returns to active status.`)) return;
                  void save(null);
                }}
                disabled={busy}
                className="text-xs text-danger-600 hover:underline disabled:opacity-50"
              >
                Clear
              </button>
            )}
          </div>
          <div className="text-2xs text-ink-faint italic pt-1 border-t border-border">
            Future returns are auto-hidden once the date passes year-end.
            Current-year matrix keeps showing it so wrap-up filings stay
            visible.
          </div>
        </div>
      )}
    </span>
  );
}

