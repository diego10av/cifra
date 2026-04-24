'use client';

// /tax-ops/other — Ad-hoc filings: VAT registrations / deregistrations,
// Functional Currency Requests. One-off, no recurring pattern.
//
// Shape is different from the matrix pages: a flat list sorted by
// filed_at / deadline_date, because there's no "period" structure.

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { PlusIcon, Trash2Icon } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { CrmErrorBox } from '@/components/crm/CrmErrorBox';
import { DateBadge } from '@/components/crm/DateBadge';
import { crmLoadShape } from '@/lib/useCrmFetch';
import {
  FilingStatusBadge, filingStatusLabel, FILING_STATUSES,
} from '@/components/tax-ops/FilingStatusBadge';
import { AddAdhocFilingModal } from '@/components/tax-ops/AddAdhocFilingModal';
import { useToast } from '@/components/Toaster';

// Stint 40.E — wht_director_adhoc added so director-fee WHT filings
// without a fixed cadence show up here alongside VAT reg/dereg and FCR.
const ADHOC_TYPES = [
  'vat_registration',
  'vat_deregistration',
  'functional_currency_request',
  'wht_director_adhoc',
] as const;

interface FilingRow {
  id: string;
  entity_id: string;
  entity_name: string;
  group_name: string | null;
  tax_type: string;
  period_label: string;
  period_year: number;
  deadline_date: string | null;
  status: string;
  assigned_to: string | null;
  comments_preview: string | null;
}

function humanTaxType(t: string): string {
  return t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default function OtherPage() {
  const [rows, setRows] = useState<FilingRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [addOpen, setAddOpen] = useState(false);
  const toast = useToast();

  const load = useCallback(() => {
    // Pull all ad-hoc filings via the existing /api/tax-ops/filings endpoint.
    // Multi tax_type param isn't supported, so we paginate per type and merge.
    Promise.all(ADHOC_TYPES.map(t =>
      crmLoadShape<FilingRow[]>(
        `/api/tax-ops/filings?tax_type=${t}&page_size=250`,
        b => (b as { filings: FilingRow[] }).filings,
      ).catch(() => [] as FilingRow[])
    ))
      .then(lists => {
        const all: FilingRow[] = ([] as FilingRow[]).concat(...lists);
        // Sort by deadline_date asc (nulls last), then entity_name.
        all.sort((a, b) => {
          const aD = a.deadline_date ?? '';
          const bD = b.deadline_date ?? '';
          if (!aD && bD) return 1;
          if (aD && !bD) return -1;
          if (aD !== bD) return aD < bD ? -1 : 1;
          return a.entity_name.localeCompare(b.entity_name);
        });
        setRows(all);
        setError(null);
      })
      .catch(e => {
        setError(String(e instanceof Error ? e.message : e));
        setRows([]);
      });
  }, []);

  useEffect(() => { load(); }, [load]);

  async function removeFiling(filingId: string) {
    if (!confirm('Delete this ad-hoc filing? (Reversible via audit log.)')) return;
    const res = await fetch(`/api/tax-ops/filings/${filingId}`, { method: 'DELETE' });
    if (!res.ok) {
      toast.error('Delete failed');
      return;
    }
    toast.success('Filing deleted');
    load();
  }

  const filtered = (rows ?? []).filter(r =>
    (typeFilter === '' || r.tax_type === typeFilter) &&
    (statusFilter === '' || r.status === statusFilter)
  );

  if (rows === null) return <PageSkeleton />;

  return (
    <div className="space-y-3">
      <PageHeader
        title="Other (ad-hoc)"
        subtitle="One-off filings: VAT registrations, VAT deregistrations, Functional Currency Requests. No recurring period pattern."
        actions={
          <button
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[12px] rounded-md bg-brand-500 hover:bg-brand-600 text-white"
          >
            <PlusIcon size={12} /> New ad-hoc filing
          </button>
        }
      />

      <AddAdhocFilingModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={load}
      />

      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-2 py-1 text-[12.5px] border border-border rounded-md bg-surface"
        >
          <option value="">All types</option>
          {ADHOC_TYPES.map(t => <option key={t} value={t}>{humanTaxType(t)}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-2 py-1 text-[12.5px] border border-border rounded-md bg-surface"
        >
          <option value="">All statuses</option>
          {FILING_STATUSES.map(s => <option key={s} value={s}>{filingStatusLabel(s)}</option>)}
        </select>
        <div className="text-[11.5px] text-ink-muted ml-auto">
          {filtered.length} ad-hoc filing{filtered.length === 1 ? '' : 's'}
        </div>
      </div>

      {error && <CrmErrorBox message={error} onRetry={load} />}

      {filtered.length === 0 ? (
        <EmptyState
          title="No ad-hoc filings match"
          description="Loosen the filters, or register a new one-off via /tax-ops/filings."
        />
      ) : (
        <div className="rounded-md border border-border bg-surface overflow-hidden">
          <table className="w-full text-[12.5px]">
            <thead className="bg-surface-alt text-ink-muted">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium">Entity</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Reference</th>
                <th className="px-3 py-2 font-medium">Deadline</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Assignee</th>
                <th className="px-3 py-2 font-medium">Comments</th>
                <th className="px-3 py-2 w-[32px]"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} className="border-t border-border hover:bg-surface-alt/40">
                  <td className="px-3 py-2">
                    <Link href={`/tax-ops/filings/${r.id}`} className="font-medium text-ink hover:text-brand-700">
                      {r.entity_name}
                    </Link>
                    {r.group_name && (
                      <div className="text-[11px] text-ink-muted">{r.group_name}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-ink-soft">{humanTaxType(r.tax_type)}</td>
                  <td className="px-3 py-2 tabular-nums text-ink-muted">{r.period_label}</td>
                  <td className="px-3 py-2"><DateBadge value={r.deadline_date} mode="urgency" /></td>
                  <td className="px-3 py-2"><FilingStatusBadge status={r.status} /></td>
                  <td className="px-3 py-2 text-ink-soft">{r.assigned_to ?? '—'}</td>
                  <td className="px-3 py-2 text-ink-soft max-w-[320px]">
                    <span className="line-clamp-2 text-[11.5px]" title={r.comments_preview ?? ''}>
                      {r.comments_preview ?? '—'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => removeFiling(r.id)}
                      aria-label="Delete filing"
                      className="p-1 text-ink-muted hover:text-danger-600"
                    >
                      <Trash2Icon size={12} />
                    </button>
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
