'use client';

import { useEffect, useState, useCallback } from 'react';
import { SearchIcon, PlusIcon } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { CrmFormModal } from '@/components/crm/CrmFormModal';
import { ExportButton } from '@/components/crm/ExportButton';
import { CrmErrorBox } from '@/components/crm/CrmErrorBox';
import { crmLoadList } from '@/lib/useCrmFetch';
import { ACTIVITY_FIELDS } from '@/components/crm/schemas';
import { useToast } from '@/components/Toaster';
// Stint 63.J — port inline-edit primitives to activities table.
import { InlineTextCell, InlineDateCell } from '@/components/tax-ops/inline-editors';
import { ChipSelect } from '@/components/tax-ops/ChipSelect';
import {
  LABELS_ACTIVITY_TYPE, ACTIVITY_TYPES,
  type ActivityType,
} from '@/lib/crm-types';

interface Activity {
  id: string;
  name: string;
  activity_type: string;
  activity_date: string;
  duration_hours: number | null;
  billable: boolean;
  outcome: string | null;
  company_name: string | null;
  opportunity_name: string | null;
  matter_reference: string | null;
  contact_name: string | null;
}

export default function ActivitiesPage() {
  const [rows, setRows] = useState<Activity[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [type, setType] = useState<string>('');
  const [newOpen, setNewOpen] = useState(false);
  const toast = useToast();

  const load = useCallback(() => {
    const qs = new URLSearchParams();
    if (q) qs.set('q', q);
    if (type) qs.set('type', type);
    crmLoadList<Activity>(`/api/crm/activities?${qs}`)
      .then(rows => { setRows(rows); setError(null); })
      .catch((e: Error) => { setError(e.message || 'Network error'); setRows([]); });
  }, [q, type]);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(values: Record<string, unknown>) {
    const res = await fetch('/api/crm/activities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message ?? `Create failed (${res.status})`);
    }
    toast.success('Activity logged');
    await load();
  }

  // Stint 63.J — inline-edit helper for activities. duration_hours is
  // the only numeric field; coerce string → number (or null) like
  // patchOpportunity does for value/probability.
  async function patchActivity(id: string, field: string, value: unknown): Promise<void> {
    let coerced = value;
    if (field === 'duration_hours' && typeof value === 'string') {
      const trimmed = value.trim().replace(/h$/i, '').trim();
      if (trimmed === '') coerced = null;
      else {
        const n = Number(trimmed.replace(/,/g, '.'));
        coerced = Number.isFinite(n) ? n : null;
      }
    }
    try {
      const res = await fetch(`/api/crm/activities/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: coerced }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message ?? `Save failed (${res.status})`);
      }
      setRows(prev => prev?.map(r =>
        r.id === id ? { ...r, [field]: coerced as never } : r
      ) ?? null);
    } catch (e) {
      toast.error(`Save failed: ${String(e instanceof Error ? e.message : e)}`);
      await load();
      throw e;
    }
  }

  if (rows === null) return <PageSkeleton />;

  return (
    <div>
      <PageHeader
        title="Activities"
        subtitle="Calls, meetings, emails, hearings, deadlines — the timeline. Click any cell to edit inline."
        actions={
          <Button onClick={() => setNewOpen(true)} variant="primary" size="sm" icon={<PlusIcon size={13} />}>
            Log activity
          </Button>
        }
      />
      <CrmFormModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        mode="create"
        title="Log new activity"
        subtitle="Call, meeting, email, or deadline that just happened or is scheduled."
        fields={ACTIVITY_FIELDS}
        initial={{
          activity_type: 'call',
          activity_date: new Date().toISOString().slice(0, 10),
          billable: false,
        }}
        onSave={handleCreate}
      />
      {error && <div className="mb-3"><CrmErrorBox message={error} onRetry={load} /></div>}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative flex-1 min-w-[220px] max-w-xs">
          <SearchIcon size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search activity..."
            className="w-full pl-7 pr-3 py-1.5 text-sm border border-border rounded-md" />
        </div>
        <select value={type} onChange={e => setType(e.target.value)}
          className="px-2 py-1.5 text-sm border border-border rounded-md bg-white">
          <option value="">All types</option>
          {ACTIVITY_TYPES.map(t => <option key={t} value={t}>{LABELS_ACTIVITY_TYPE[t]}</option>)}
        </select>
        <div className="ml-auto flex items-center gap-2">
          <ExportButton entity="activities" />
          <span className="text-xs text-ink-muted">{rows.length} activities</span>
        </div>
      </div>

      {rows.length === 0 ? (
        (() => {
          const filtersActive = q !== '' || type !== '';
          return (
            <EmptyState
              illustration="clock"
              title={filtersActive ? 'No activities match these filters' : 'No activities yet'}
              description={filtersActive
                ? 'Loosen your filters or clear them to see all activities.'
                : 'Log calls, meetings and emails to build the client timeline. Press N anywhere in /crm for quick-capture.'}
              action={filtersActive ? undefined : (
                <Button onClick={() => setNewOpen(true)} variant="primary" size="sm" icon={<PlusIcon size={13} />}>
                  Log activity
                </Button>
              )}
            />
          );
        })()
      ) : (
        <div className="border border-border rounded-lg overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead className="bg-surface-alt text-ink-muted">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Date</th>
                <th className="text-left px-3 py-2 font-medium">Type</th>
                <th className="text-left px-3 py-2 font-medium">Name</th>
                <th className="text-left px-3 py-2 font-medium">Relates to</th>
                <th className="text-right px-3 py-2 font-medium">Dur.</th>
                <th className="text-center px-3 py-2 font-medium">Billable</th>
                <th className="text-left px-3 py-2 font-medium">Outcome</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-t border-border hover:bg-surface-alt/50">
                  {/* Date — InlineDateCell, neutral mode (past activity, not action-triggering). */}
                  <td className="px-3 py-2">
                    <InlineDateCell
                      value={r.activity_date}
                      onSave={async v => { await patchActivity(r.id, 'activity_date', v); }}
                      mode="neutral"
                    />
                  </td>
                  {/* Type — ChipSelect with fixed taxonomy. */}
                  <td className="px-3 py-2">
                    <ChipSelect
                      value={r.activity_type}
                      options={ACTIVITY_TYPES.map(v => ({
                        value: v,
                        label: LABELS_ACTIVITY_TYPE[v as ActivityType],
                      }))}
                      onChange={next => { void patchActivity(r.id, 'activity_type', next); }}
                      ariaLabel="Activity type"
                    />
                  </td>
                  {/* Name — InlineTextCell. */}
                  <td className="px-3 py-2 max-w-[260px]">
                    <InlineTextCell
                      value={r.name}
                      onSave={async v => { await patchActivity(r.id, 'name', v); }}
                      placeholder="Untitled activity"
                    />
                  </td>
                  {/* Relates to — read-only (changing relations from a list
                      cell is a heavy edit; happens in detail page or via
                      the create modal). */}
                  <td className="px-3 py-2 text-ink-muted">
                    {[r.company_name, r.matter_reference, r.opportunity_name, r.contact_name].filter(Boolean).join(' · ') || '—'}
                  </td>
                  {/* Duration — InlineTextCell, accepts "1.5", "1.5h", etc. */}
                  <td className="px-3 py-2 text-right tabular-nums max-w-[80px]">
                    <InlineTextCell
                      value={r.duration_hours !== null ? `${Number(r.duration_hours).toFixed(1)}h` : null}
                      onSave={async v => { await patchActivity(r.id, 'duration_hours', v); }}
                      placeholder="—"
                    />
                  </td>
                  {/* Billable — toggle. Click to flip. Show ✓ when true,
                      empty box (·) hint when false. */}
                  <td className="px-3 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => { void patchActivity(r.id, 'billable', !r.billable); }}
                      className={[
                        'inline-flex items-center justify-center w-5 h-5 rounded border text-xs',
                        r.billable
                          ? 'bg-success-50 border-success-200 text-success-700'
                          : 'border-border hover:border-brand-500 text-ink-faint',
                      ].join(' ')}
                      aria-label={r.billable ? 'Mark as non-billable' : 'Mark as billable'}
                      title={r.billable ? 'Billable · click to unflag' : 'Not billable · click to flag'}
                    >
                      {r.billable ? '✓' : ''}
                    </button>
                  </td>
                  {/* Outcome — InlineTextCell, multi-line not needed (short
                      summary; long notes go in the detail page). */}
                  <td className="px-3 py-2 max-w-[260px]">
                    <InlineTextCell
                      value={r.outcome}
                      onSave={async v => { await patchActivity(r.id, 'outcome', v); }}
                      placeholder="—"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
