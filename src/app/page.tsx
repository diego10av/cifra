'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Entity {
  id: string;
  name: string;
  client_name: string | null;
  regime: string;
  frequency: string;
}

interface Declaration {
  id: string;
  entity_id: string;
  entity_name: string;
  year: number;
  period: string;
  status: string;
  vat_due: number | null;
  created_at: string;
}

interface DeadlineRow {
  entity_id: string;
  due_date: string;
  days_until: number;
  is_overdue: boolean;
  bucket: string;
  declaration_id: string | null;
  declaration_status: string;
}

export default function Home() {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [declarations, setDeclarations] = useState<Declaration[]>([]);
  const [deadlines, setDeadlines] = useState<DeadlineRow[]>([]);

  useEffect(() => {
    fetch('/api/entities').then(r => r.json()).then(setEntities);
    fetch('/api/declarations').then(r => r.json()).then(setDeclarations);
    fetch('/api/deadlines').then(r => r.json()).then(setDeadlines);
  }, []);

  // KPIs
  const inReview = declarations.filter(d => d.status === 'review').length;
  const overdue = deadlines.filter(d => d.is_overdue).length;
  const dueIn7 = deadlines.filter(d => d.bucket === 'urgent').length;

  // Per-entity portfolio: pair entity with most recent declaration + next deadline
  const entitiesWithStatus = entities.map(e => {
    const lastDecl = declarations
      .filter(d => d.entity_id === e.id)
      .sort((a, b) => (b.year - a.year) || b.period.localeCompare(a.period))[0];
    const dl = deadlines.find(d => d.entity_id === e.id);
    return { entity: e, decl: lastDecl, deadline: dl };
  });

  // Sort entities: overdue first, then by days_until ascending
  const sortedEntities = entitiesWithStatus.sort((a, b) => {
    const da = a.deadline?.days_until ?? 9999;
    const db = b.deadline?.days_until ?? 9999;
    return da - db;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[20px] font-semibold tracking-tight">Portfolio</h1>
          <p className="text-[12px] text-gray-500 mt-1">
            All entities and their next filing milestone, at a glance.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/entities" className="h-8 px-3 rounded border border-gray-300 text-[12px] font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all duration-150 inline-flex items-center cursor-pointer">
            Manage entities
          </Link>
          <Link href="/declarations" className="h-8 px-3 rounded bg-[#1a1a2e] text-white text-[12px] font-semibold hover:bg-[#2a2a4e] transition-all duration-150 inline-flex items-center cursor-pointer">
            New declaration
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <KPI label="Entities" value={entities.length} color="text-gray-900" />
        <KPI label="In review" value={inReview} color={inReview > 0 ? 'text-orange-600' : 'text-gray-400'} />
        <KPI label="Due in 7 days" value={dueIn7} color={dueIn7 > 0 ? 'text-amber-600' : 'text-gray-400'} />
        <KPI label="Overdue" value={overdue} color={overdue > 0 ? 'text-red-600' : 'text-gray-400'} />
      </div>

      {/* Portfolio table */}
      {entities.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-[13px] text-gray-500">
          No entities yet.{' '}
          <Link href="/entities" className="text-blue-600 hover:underline font-medium">
            Create your first entity
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-[12px]">
            <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
              <tr>
                <th className="px-3 py-2 text-left font-medium uppercase tracking-wide text-[10px]">Client / Entity</th>
                <th className="px-3 py-2 text-left font-medium uppercase tracking-wide text-[10px]">Regime · Frequency</th>
                <th className="px-3 py-2 text-left font-medium uppercase tracking-wide text-[10px]">Latest period</th>
                <th className="px-3 py-2 text-left font-medium uppercase tracking-wide text-[10px]">Status</th>
                <th className="px-3 py-2 text-right font-medium uppercase tracking-wide text-[10px]">Due</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {sortedEntities.map(({ entity: e, decl, deadline }) => (
                <tr key={e.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60 transition-colors duration-150">
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-gray-900">{e.name}</div>
                    {e.client_name && (
                      <div className="text-[11px] text-gray-500 mt-0.5">{e.client_name}</div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-gray-700 capitalize">{e.regime} · {e.frequency}</td>
                  <td className="px-3 py-2.5 text-gray-700">
                    {decl ? `${decl.year} ${decl.period}` : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    {decl ? <StatusPill status={decl.status} /> : <StatusPill status="not_started" />}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {deadline ? <BucketBadge bucket={deadline.bucket} days={deadline.days_until} /> : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {decl ? (
                      <Link href={`/declarations/${decl.id}`} className="text-blue-600 hover:underline text-[11px] font-medium">
                        Open
                      </Link>
                    ) : (
                      <Link href={`/declarations?entity_id=${e.id}`} className="text-blue-600 hover:underline text-[11px] font-medium">
                        Start
                      </Link>
                    )}
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

function KPI({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3">
      <div className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold">{label}</div>
      <div className={`text-2xl font-bold mt-1 tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

function BucketBadge({ bucket, days }: { bucket: string; days: number }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    overdue:    { bg: 'bg-red-100',     text: 'text-red-700',     label: `${Math.abs(days)}d overdue` },
    urgent:     { bg: 'bg-orange-100',  text: 'text-orange-700',  label: `${days}d` },
    soon:       { bg: 'bg-amber-100',   text: 'text-amber-700',   label: `${days}d` },
    comfortable:{ bg: 'bg-blue-100',    text: 'text-blue-700',    label: `${days}d` },
    far:        { bg: 'bg-gray-100',    text: 'text-gray-600',    label: `${days}d` },
  };
  const c = map[bucket] || map.far;
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
