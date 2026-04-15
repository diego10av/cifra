'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface DeadlineRow {
  entity_id: string;
  entity_name: string;
  regime: string;
  frequency: string;
  declaration_id: string | null;
  declaration_status: string;
  year: number;
  period: string;
  due_date: string;
  days_until: number;
  is_overdue: boolean;
  bucket: 'overdue' | 'urgent' | 'soon' | 'comfortable' | 'far';
  description: string;
}

export default function DeadlinesPage() {
  const [rows, setRows] = useState<DeadlineRow[] | null>(null);
  const [filter, setFilter] = useState<'all' | 'open' | 'overdue'>('all');

  useEffect(() => {
    fetch('/api/deadlines').then(r => r.json()).then(setRows);
  }, []);

  if (!rows) return <div className="text-center py-12 text-gray-500">Loading…</div>;

  // Filter
  let visible = rows;
  if (filter === 'open') visible = rows.filter(r => r.declaration_status !== 'paid');
  if (filter === 'overdue') visible = rows.filter(r => r.is_overdue);

  // Sort: overdue first, then by days_until ascending
  visible = [...visible].sort((a, b) => a.days_until - b.days_until);

  const counts = {
    all: rows.length,
    overdue: rows.filter(r => r.is_overdue).length,
    urgent: rows.filter(r => r.bucket === 'urgent').length,
    soon: rows.filter(r => r.bucket === 'soon').length,
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[20px] font-semibold tracking-tight">Deadlines</h1>
          <p className="text-[12px] text-gray-500 mt-1">
            Next filing deadline per entity, computed from the declaration period and the AED rules.
          </p>
        </div>
        <div className="flex gap-1">
          <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>All ({counts.all})</FilterChip>
          <FilterChip active={filter === 'open'} onClick={() => setFilter('open')}>Open</FilterChip>
          <FilterChip active={filter === 'overdue'} onClick={() => setFilter('overdue')}>
            Overdue ({counts.overdue})
          </FilterChip>
        </div>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <KPI label="Overdue" value={counts.overdue} color={counts.overdue > 0 ? 'text-red-600' : 'text-gray-400'} />
        <KPI label="Due in 7 days" value={counts.urgent} color={counts.urgent > 0 ? 'text-orange-600' : 'text-gray-400'} />
        <KPI label="Due in 30 days" value={counts.soon} color="text-amber-600" />
        <KPI label="Tracked entities" value={counts.all} color="text-gray-700" />
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-[12px]">
          <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
            <tr>
              <th className="px-3 py-2 text-left font-medium uppercase tracking-wide text-[10px]">Entity</th>
              <th className="px-3 py-2 text-left font-medium uppercase tracking-wide text-[10px]">Regime / Freq.</th>
              <th className="px-3 py-2 text-left font-medium uppercase tracking-wide text-[10px]">Period</th>
              <th className="px-3 py-2 text-left font-medium uppercase tracking-wide text-[10px]">Status</th>
              <th className="px-3 py-2 text-left font-medium uppercase tracking-wide text-[10px]">Due date</th>
              <th className="px-3 py-2 text-right font-medium uppercase tracking-wide text-[10px]">Time left</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No items match this filter.</td></tr>
            )}
            {visible.map(r => (
              <tr
                key={r.entity_id + r.year + r.period}
                className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60 transition-colors duration-150"
              >
                <td className="px-3 py-2 font-medium text-gray-900">{r.entity_name}</td>
                <td className="px-3 py-2 text-gray-600 capitalize">{r.regime} · {r.frequency}</td>
                <td className="px-3 py-2 text-gray-700">{r.year} {r.period}</td>
                <td className="px-3 py-2"><StatusPill status={r.declaration_status} /></td>
                <td className="px-3 py-2 text-gray-700 tabular-nums">{formatDate(r.due_date)}</td>
                <td className="px-3 py-2 text-right">
                  <BucketBadge bucket={r.bucket} days={r.days_until} />
                </td>
                <td className="px-3 py-2 text-right">
                  {r.declaration_id ? (
                    <Link href={`/declarations/${r.declaration_id}`}
                      className="text-blue-600 hover:underline text-[11px] font-medium">Open</Link>
                  ) : (
                    <Link href={`/declarations?entity_id=${r.entity_id}`}
                      className="text-blue-600 hover:underline text-[11px] font-medium">Create</Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`h-7 px-2.5 rounded text-[11px] font-medium transition-colors duration-150 cursor-pointer ${
        active ? 'bg-[#1a1a2e] text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
      }`}
    >
      {children}
    </button>
  );
}

function KPI({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3">
      <div className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold">{label}</div>
      <div className={`text-2xl font-bold mt-1 tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

function BucketBadge({ bucket, days }: { bucket: DeadlineRow['bucket']; days: number }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    overdue:    { bg: 'bg-red-100',     text: 'text-red-700',     label: `${Math.abs(days)}d overdue` },
    urgent:     { bg: 'bg-orange-100',  text: 'text-orange-700',  label: `${days}d` },
    soon:       { bg: 'bg-amber-100',   text: 'text-amber-700',   label: `${days}d` },
    comfortable:{ bg: 'bg-blue-100',    text: 'text-blue-700',    label: `${days}d` },
    far:        { bg: 'bg-gray-100',    text: 'text-gray-600',    label: `${days}d` },
  };
  const c = map[bucket];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide tabular-nums ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  const colors: Record<string, string> = {
    not_started: 'bg-gray-100 text-gray-500',
    created: 'bg-gray-100 text-gray-700',
    uploading: 'bg-blue-100 text-blue-700',
    extracting: 'bg-purple-100 text-purple-700',
    classifying: 'bg-yellow-100 text-yellow-700',
    review: 'bg-orange-100 text-orange-700',
    approved: 'bg-green-100 text-green-700',
    filed: 'bg-emerald-100 text-emerald-800',
    paid: 'bg-teal-100 text-teal-800',
  };
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded font-semibold uppercase tracking-wide ${colors[status] || 'bg-gray-100'}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

function formatDate(d: string | null): string {
  if (!d) return '—';
  const parts = d.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return d;
}
