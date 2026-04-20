'use client';

// ════════════════════════════════════════════════════════════════════════
// NewDeclarationModal — create a declaration directly from anywhere in
// the app, then jump straight to its review page.
//
// Replaces the old "click New Declaration on home → scroll to bottom of
// /declarations list → find the form" flow that Diego flagged as clunky
// on 2026-04-20.
//
// The modal:
//   - Auto-picks the "next unfiled period" suggestion for the selected
//     entity (same algorithm the list page uses).
//   - Validates entity + year + period before enabling Create.
//   - On success, router.push(`/declarations/${id}`) so you're in the
//     review flow instantly.
// ════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/Toaster';
import { describeApiError } from '@/lib/ui-errors';
import { PlusIcon, Loader2Icon } from 'lucide-react';

interface EntityOption {
  id: string;
  name: string;
  regime: string;
  frequency: string; // 'monthly' | 'quarterly' | 'annual' (legacy inconsistency)
  client_name?: string | null;
}

interface ExistingDecl {
  id: string;
  entity_id: string;
  year: number;
  period: string;
}

function periodsForFrequency(freq: string): string[] {
  if (freq === 'annual' || freq === 'yearly') return ['Y1'];
  if (freq === 'quarterly') return ['Q1', 'Q2', 'Q3', 'Q4'];
  return ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
}

export function NewDeclarationModal({
  open, onClose,
  /** Optional default-entity (e.g. invoked from an entity detail page). */
  defaultEntityId,
}: {
  open: boolean;
  onClose: () => void;
  defaultEntityId?: string;
}) {
  const router = useRouter();
  const toast = useToast();

  const [entities, setEntities] = useState<EntityOption[]>([]);
  const [existing, setExisting] = useState<ExistingDecl[]>([]);
  const [loading, setLoading] = useState(false);
  const [entityId, setEntityId] = useState<string>(defaultEntityId ?? '');
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [period, setPeriod] = useState<string>('');
  const [saving, setSaving] = useState(false);

  // Load entities + existing declarations on open.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const [entRes, declRes] = await Promise.all([
          fetch('/api/entities').then(r => r.ok ? r.json() : []),
          fetch('/api/declarations').then(r => r.ok ? r.json() : []),
        ]);
        if (cancelled) return;
        setEntities(entRes as EntityOption[]);
        setExisting((declRes as ExistingDecl[]) ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open]);

  // Reset when closed.
  useEffect(() => {
    if (!open) {
      setEntityId(defaultEntityId ?? '');
      setPeriod('');
      setYear(new Date().getFullYear());
    }
  }, [open, defaultEntityId]);

  // Auto-pick the next unfiled period for the chosen entity. Walks
  // backward from the current calendar year up to 3 years.
  const suggested = useMemo(() => {
    if (!entityId) return null;
    const entity = entities.find(e => e.id === entityId);
    if (!entity) return null;
    const taken = new Set(
      existing.filter(d => d.entity_id === entityId).map(d => `${d.year}::${d.period}`),
    );
    const now = new Date();
    const currentYear = now.getUTCFullYear();
    for (let offset = 0; offset < 3; offset++) {
      const y = currentYear - offset;
      const periods = periodsForFrequency(entity.frequency);
      for (let i = periods.length - 1; i >= 0; i--) {
        const p = periods[i];
        if (!taken.has(`${y}::${p}`)) return { year: y, period: p };
      }
    }
    return null;
  }, [entityId, entities, existing]);

  useEffect(() => {
    if (suggested && !period) {
      setYear(suggested.year);
      setPeriod(suggested.period);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggested]);

  async function create() {
    if (!entityId) { toast.error('Pick an entity first.'); return; }
    if (!period) { toast.error('Pick a period.'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/declarations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity_id: entityId, year, period }),
      });
      if (!res.ok) {
        const e = await describeApiError(res, 'Could not create the declaration.');
        toast.error(e.message, e.hint);
        return;
      }
      const data = await res.json();
      toast.success('Declaration created. Opening it now…');
      onClose();
      router.push(`/declarations/${data.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Network error.');
    } finally {
      setSaving(false);
    }
  }

  const entity = entities.find(e => e.id === entityId);
  const availablePeriods = entity ? periodsForFrequency(entity.frequency) : [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New declaration"
      subtitle="Pick the entity and the period. cifra creates the declaration and opens it for review."
      size="md"
      dismissable={!saving}
      footer={
        <>
          <button
            onClick={onClose}
            disabled={saving}
            className="h-9 px-3.5 rounded-md border border-border-strong text-[12.5px] font-medium text-ink-muted hover:text-ink disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={create}
            disabled={saving || !entityId || !period}
            className="h-9 px-4 rounded-md bg-brand-500 text-white text-[12.5px] font-semibold hover:bg-brand-600 disabled:opacity-40 inline-flex items-center gap-1.5"
          >
            {saving ? <Loader2Icon size={12} className="animate-spin" /> : <PlusIcon size={12} />}
            Create and open
          </button>
        </>
      }
    >
      {loading ? (
        <div className="text-[13px] text-ink-muted">Loading entities…</div>
      ) : entities.length === 0 ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-900">
          You need at least one entity to create a declaration.{' '}
          <a href="/clients/new" className="underline font-medium">Create your first client and entity</a>.
        </div>
      ) : (
        <div className="space-y-4">
          <label className="block">
            <div className="text-[10.5px] uppercase tracking-wide font-semibold text-ink-muted mb-1">Entity</div>
            <select
              value={entityId}
              onChange={(e) => { setEntityId(e.target.value); setPeriod(''); }}
              className="w-full border border-border-strong rounded px-2 py-2 text-[13px] bg-white focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              autoFocus
            >
              <option value="">Select entity…</option>
              {entities.map(e => (
                <option key={e.id} value={e.id}>
                  {e.name}
                  {e.client_name ? ` · ${e.client_name}` : ''}
                  {' · '}{e.regime} / {e.frequency}
                </option>
              ))}
            </select>
          </label>

          {suggested && (
            <div className="text-[11.5px] text-brand-700 bg-brand-50 border border-brand-100 rounded-md px-3 py-2">
              Suggested next unfiled period:{' '}
              <strong>{suggested.year} {suggested.period}</strong>
              {' '}({entity?.frequency})
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <div className="text-[10.5px] uppercase tracking-wide font-semibold text-ink-muted mb-1">Year</div>
              <select
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value, 10))}
                className="w-full border border-border-strong rounded px-2 py-2 text-[13px] bg-white focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 tabular-nums"
              >
                {[2024, 2025, 2026, 2027, 2028].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <div className="text-[10.5px] uppercase tracking-wide font-semibold text-ink-muted mb-1">Period</div>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                disabled={!entityId}
                className="w-full border border-border-strong rounded px-2 py-2 text-[13px] bg-white focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-50"
              >
                <option value="">Select period…</option>
                {availablePeriods.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </label>
          </div>

          {entityId && period && existing.some(d => d.entity_id === entityId && d.year === year && d.period === period) && (
            <div className="text-[11.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              This entity already has a declaration for {year} {period}. Creating a duplicate will fail.
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
