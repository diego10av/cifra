'use client';

// ════════════════════════════════════════════════════════════════════════
// DealsAtRiskWidget — pipeline hygiene panel on /crm home. Surfaces
// two distinct risk types from the NBA feed:
//   - opp_stuck:        >14 days without stage change
//   - opp_close_overdue: estimated_close_date already passed
//
// The full NBA feed ranks across 8 sources; this view filters to
// just the two pipeline-risk sources so partners can spot deals
// that need unblocking without scanning tasks/invoices/follow-ups.
// ════════════════════════════════════════════════════════════════════════

import Link from 'next/link';
import { ClockIcon, AlertTriangleIcon, ChevronRightIcon } from 'lucide-react';
import { useCrmFetch } from '@/lib/useCrmFetch';
import { CrmErrorBox } from '@/components/crm/CrmErrorBox';

interface NextAction {
  id: string;
  type: string;
  priority: number;
  title: string;
  detail: string;
  link: string;
  target_type: string;
  target_id: string;
}

interface NextActionsResponse {
  actions: NextAction[];
  total_candidates: number;
}

const RISK_TYPES = new Set(['opp_stuck', 'opp_close_overdue']);

export function DealsAtRiskWidget() {
  const { data, error, isLoading, refetch } = useCrmFetch<NextActionsResponse>('/api/crm/next-actions');

  if (error) return <CrmErrorBox message={error} onRetry={refetch} />;
  if (!data || isLoading) {
    return <div className="text-[12px] text-ink-muted italic px-3 py-6">Scanning pipeline risk…</div>;
  }

  const atRisk = (data.actions ?? [])
    .filter(a => RISK_TYPES.has(a.type))
    .slice(0, 5);

  return (
    <div className="border border-border rounded-lg bg-white overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangleIcon size={14} className={atRisk.length > 0 ? 'text-danger-600' : 'text-ink-muted'} />
          <h2 className="text-[13px] uppercase tracking-wide font-semibold text-ink-muted">
            Deals at risk
          </h2>
        </div>
        <span className="text-[11px] text-ink-muted">
          {atRisk.length === 0 ? 'none' : `${atRisk.length} flagged`}
        </span>
      </div>
      {atRisk.length === 0 ? (
        <div className="p-4 text-[13px] text-emerald-700 font-medium">
          ✓ Pipeline is healthy.
          <div className="text-[11.5px] text-ink-muted mt-0.5 italic font-normal">
            No opps stuck &gt;14 days, no overdue close dates.
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {atRisk.map(a => (
            <li key={a.id}>
              <Link href={a.link} className="flex items-start gap-3 px-4 py-2.5 hover:bg-surface-alt/60">
                <ClockIcon size={14} className={`shrink-0 mt-0.5 ${a.type === 'opp_close_overdue' ? 'text-danger-600' : 'text-amber-600'}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-medium text-ink truncate">{a.title}</div>
                  <div className="text-[11px] text-ink-muted mt-0.5 truncate">{a.detail}</div>
                </div>
                <ChevronRightIcon size={12} className="shrink-0 mt-1 text-ink-muted" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
