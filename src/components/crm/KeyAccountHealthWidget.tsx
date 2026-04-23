'use client';

// ════════════════════════════════════════════════════════════════════════
// KeyAccountHealthWidget — a scan of every Key Account's relational
// health. For a LU PE partner, this is the "am I keeping my top 10
// clients warm?" view. Risk is computed server-side from days since
// last activity; widget just renders.
//
// Clicking a row → company detail. Each row exposes pipeline value,
// matter count, outstanding €, and a coloured risk pill.
// ════════════════════════════════════════════════════════════════════════

import Link from 'next/link';
import { ShieldCheckIcon, ChevronRightIcon } from 'lucide-react';
import { useCrmFetch } from '@/lib/useCrmFetch';
import { CrmErrorBox } from '@/components/crm/CrmErrorBox';
import { formatEur } from '@/lib/crm-types';

interface Account {
  id: string;
  company_name: string;
  last_touched: string | null;
  days_since_touch: number | null;
  open_opps_count: number;
  pipeline_value: number;
  open_matters_count: number;
  outstanding_total: number;
  risk: 'green' | 'amber' | 'red';
}

interface Response {
  accounts: Account[];
  total_pipeline: number;
  total_outstanding: number;
  at_risk_count: number;
  warming_count: number;
}

const RISK_CLASS: Record<Account['risk'], string> = {
  green: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  amber: 'bg-amber-100  text-amber-800  border-amber-200',
  red:   'bg-danger-100 text-danger-800 border-danger-200',
};

const RISK_LABEL: Record<Account['risk'], string> = {
  green: 'Warm',
  amber: 'Cooling',
  red:   'At risk',
};

export function KeyAccountHealthWidget() {
  const { data, error, isLoading, refetch } = useCrmFetch<Response>('/api/crm/key-accounts/health');

  if (error) return <CrmErrorBox message={error} onRetry={refetch} />;
  if (!data || isLoading) {
    return <div className="text-[12px] text-ink-muted italic px-3 py-6">Computing Key Account health…</div>;
  }

  if (data.accounts.length === 0) {
    return (
      <div className="border border-border rounded-lg bg-white p-4">
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheckIcon size={14} className="text-brand-600" />
          <h2 className="text-[13px] uppercase tracking-wide font-semibold text-ink-muted">Key Account health</h2>
        </div>
        <p className="text-[13px] text-ink-soft">
          No Key Accounts set yet. Mark your top clients with classification = Key Account on the company detail page.
        </p>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg bg-white overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheckIcon size={14} className="text-brand-600" />
          <h2 className="text-[13px] uppercase tracking-wide font-semibold text-ink-muted">
            Key Account health · {data.accounts.length}
          </h2>
        </div>
        <div className="flex items-center gap-3 text-[11px] tabular-nums">
          {data.at_risk_count > 0 && (
            <span className="text-danger-700"><strong>{data.at_risk_count}</strong> at risk</span>
          )}
          {data.warming_count > 0 && (
            <span className="text-amber-700"><strong>{data.warming_count}</strong> cooling</span>
          )}
          <span className="text-ink-muted">Pipeline: <strong>{formatEur(data.total_pipeline)}</strong></span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12.5px]">
          <thead className="bg-surface-alt/40 text-ink-muted">
            <tr>
              <th className="text-left px-3 py-1.5 font-medium">Account</th>
              <th className="text-left px-3 py-1.5 font-medium">Last touched</th>
              <th className="text-right px-3 py-1.5 font-medium">Opps</th>
              <th className="text-right px-3 py-1.5 font-medium">Pipeline</th>
              <th className="text-right px-3 py-1.5 font-medium">Matters</th>
              <th className="text-right px-3 py-1.5 font-medium">Outstanding</th>
              <th className="text-left px-3 py-1.5 font-medium">Status</th>
              <th className="px-3 py-1.5"></th>
            </tr>
          </thead>
          <tbody>
            {data.accounts.map(a => (
              <tr key={a.id} className="border-t border-border hover:bg-surface-alt/30">
                <td className="px-3 py-2">
                  <Link href={`/crm/companies/${a.id}`} className="font-medium text-brand-700 hover:underline">
                    {a.company_name}
                  </Link>
                </td>
                <td className="px-3 py-2 text-ink-muted tabular-nums">
                  {a.last_touched
                    ? `${a.days_since_touch}d ago`
                    : <span className="italic">never</span>}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{a.open_opps_count || '—'}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {a.pipeline_value > 0 ? formatEur(a.pipeline_value) : '—'}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{a.open_matters_count || '—'}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {a.outstanding_total > 0
                    ? <span className="text-amber-700">{formatEur(a.outstanding_total)}</span>
                    : '—'}
                </td>
                <td className="px-3 py-2">
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10.5px] font-medium ${RISK_CLASS[a.risk]}`}>
                    {RISK_LABEL[a.risk]}
                  </span>
                </td>
                <td className="px-3 py-2 text-ink-muted">
                  <Link href={`/crm/companies/${a.id}`} className="hover:text-ink">
                    <ChevronRightIcon size={13} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
