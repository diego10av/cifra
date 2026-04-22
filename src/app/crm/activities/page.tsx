'use client';

import { useEffect, useState } from 'react';
import { SearchIcon } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  LABELS_ACTIVITY_TYPE, ACTIVITY_TYPES, formatDate,
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
  const [q, setQ] = useState('');
  const [type, setType] = useState<string>('');

  useEffect(() => {
    const qs = new URLSearchParams();
    if (q) qs.set('q', q);
    if (type) qs.set('type', type);
    fetch(`/api/crm/activities?${qs}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(setRows)
      .catch(() => setRows([]));
  }, [q, type]);

  if (rows === null) return <PageSkeleton />;

  return (
    <div>
      <PageHeader title="Activities" subtitle="Calls, meetings, emails, hearings, deadlines — the timeline." />
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative flex-1 min-w-[220px] max-w-xs">
          <SearchIcon size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search activity..."
            className="w-full pl-7 pr-3 py-1.5 text-[12.5px] border border-border rounded-md focus:outline-none focus:border-brand-500" />
        </div>
        <select value={type} onChange={e => setType(e.target.value)}
          className="px-2 py-1.5 text-[12.5px] border border-border rounded-md bg-white">
          <option value="">All types</option>
          {ACTIVITY_TYPES.map(t => <option key={t} value={t}>{LABELS_ACTIVITY_TYPE[t]}</option>)}
        </select>
        <span className="ml-auto text-[11.5px] text-ink-muted">{rows.length} activities</span>
      </div>

      {rows.length === 0 ? (
        <EmptyState illustration="clock" title="No activities yet" description="Log calls, meetings and emails to build the client timeline." />
      ) : (
        <div className="border border-border rounded-lg overflow-hidden bg-white">
          <table className="w-full text-[12.5px]">
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
                  <td className="px-3 py-2 tabular-nums">{formatDate(r.activity_date)}</td>
                  <td className="px-3 py-2">{LABELS_ACTIVITY_TYPE[r.activity_type as ActivityType] ?? r.activity_type}</td>
                  <td className="px-3 py-2 font-medium">{r.name}</td>
                  <td className="px-3 py-2 text-ink-muted">
                    {[r.company_name, r.matter_reference, r.opportunity_name, r.contact_name].filter(Boolean).join(' · ') || '—'}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.duration_hours !== null ? `${Number(r.duration_hours).toFixed(1)}h` : '—'}</td>
                  <td className="px-3 py-2 text-center">{r.billable ? '✓' : ''}</td>
                  <td className="px-3 py-2 text-ink-muted truncate max-w-[260px]" title={r.outcome ?? ''}>{r.outcome ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
