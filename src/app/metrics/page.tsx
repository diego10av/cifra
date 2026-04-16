'use client';

// Metrics page — ops dashboard.
//
// Three panels:
//  1. Budget — monthly Anthropic spend vs the cap set by BUDGET_MONTHLY_EUR.
//     Progress bar + daily-spend sparkline + cost-by-agent breakdown.
//     When > 80% soft-warn a brand-pink banner; when > 100% a danger banner.
//  2. Quality — extraction + classification accuracy KPIs vs PRD targets.
//  3. Breakdown — rule frequency, classification-source split,
//     declarations by status.

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { AlertOctagonIcon, AlertTriangleIcon, SparklesIcon } from 'lucide-react';

interface MetricsData {
  extraction: { total_invoices: number; corrected: number; accuracy_pct: number | null; target_pct: number };
  classification: {
    total_lines: number; changed_by_user: number; accuracy_pct: number | null; target_pct: number;
    by_source: { rule: number; precedent: number; inference: number; manual: number };
    by_rule: { classification_rule: string; n: number }[];
  };
  declarations_by_status: { status: string; n: number }[];
  activity_last_30d: { d: string; n: number }[];
  cost_estimate: {
    anthropic_api_calls: number; anthropic_eur: number;
    total_tokens: number | null;
    is_real: boolean;
    by_agent: Array<{ agent: string; calls: number; total_eur: number }>;
    note: string;
  };
  budget: {
    month_spend_eur: number;
    limit_eur: number;
    pct_used: number;
    remaining_eur: number;
    over_soft_warn: boolean;
    over_budget: boolean;
    daily_spend: Array<{ d: string; eur: number; calls: number }>;
  };
}

export default function MetricsPage() {
  const [data, setData] = useState<MetricsData | null>(null);
  useEffect(() => { fetch('/api/metrics').then(r => r.json()).then(setData); }, []);

  if (!data) return <PageSkeleton />;

  const exAcc = data.extraction.accuracy_pct;
  const clAcc = data.classification.accuracy_pct;
  const totalSource = Object.values(data.classification.by_source).reduce((s, n) => s + n, 0);

  return (
    <div className="max-w-[1200px]">
      <PageHeader
        title="Metrics"
        subtitle="Ops and quality dashboard. Monthly budget, Anthropic spend per agent, classifier accuracy, rule frequency."
      />

      {/* ═══════════ BUDGET PANEL ═══════════ */}
      <section className="mb-8">
        {data.budget.over_budget ? (
          <Banner tone="danger" icon={<AlertOctagonIcon size={18} />}>
            <strong>Monthly budget reached.</strong>{' '}
            €{data.budget.month_spend_eur.toFixed(2)} of €{data.budget.limit_eur.toFixed(2)}.
            New AI calls are blocked until the 1st of next month, or until
            <code className="bg-surface-alt px-1 py-0.5 rounded text-[11px] mx-1">BUDGET_MONTHLY_EUR</code>
            is raised in Vercel env.
          </Banner>
        ) : data.budget.over_soft_warn ? (
          <Banner tone="warning" icon={<AlertTriangleIcon size={18} />}>
            <strong>Heads up — {(data.budget.pct_used * 100).toFixed(0)}% of monthly budget used.</strong>{' '}
            €{data.budget.remaining_eur.toFixed(2)} remaining. AI calls will refuse at 100%.
          </Banner>
        ) : null}

        <div className="bg-surface border border-border rounded-xl shadow-xs overflow-hidden">
          <header className="px-5 py-3 border-b border-divider flex items-center justify-between bg-gradient-to-br from-brand-50/60 to-surface">
            <div className="flex items-center gap-2">
              <SparklesIcon size={14} className="text-brand-500" />
              <h3 className="text-[13px] font-semibold text-ink tracking-tight">Anthropic budget · this month</h3>
            </div>
            <div className="text-[11px] text-ink-muted">
              Configure via <code className="bg-surface-alt px-1 py-0.5 rounded text-[10.5px]">BUDGET_MONTHLY_EUR</code>
            </div>
          </header>

          <div className="p-5">
            <div className="flex items-baseline gap-3 flex-wrap">
              <div className="text-[32px] font-bold text-ink tabular-nums tracking-tight leading-none" style={{ letterSpacing: '-0.02em' }}>
                €{data.budget.month_spend_eur.toFixed(2)}
              </div>
              <div className="text-[14px] text-ink-muted">
                of €{data.budget.limit_eur.toFixed(2)} ({(data.budget.pct_used * 100).toFixed(1)}%)
              </div>
              <div className="flex-1" />
              <div className="text-[13px] text-ink-soft">
                €{data.budget.remaining_eur.toFixed(2)} remaining
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-3 h-2 w-full bg-surface-alt rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  data.budget.over_budget
                    ? 'bg-danger-500'
                    : data.budget.over_soft_warn
                      ? 'bg-warning-500'
                      : 'bg-brand-500'
                }`}
                style={{ width: `${Math.min(100, data.budget.pct_used * 100)}%` }}
              />
            </div>

            {/* Daily sparkline */}
            {data.budget.daily_spend.length > 0 && (
              <div className="mt-5">
                <div className="text-[10.5px] uppercase tracking-[0.06em] font-semibold text-ink-muted mb-2">
                  Daily spend this month
                </div>
                <DailySparkline days={data.budget.daily_spend} />
              </div>
            )}

            {/* By agent */}
            {data.cost_estimate.by_agent.length > 0 && (
              <div className="mt-6 pt-5 border-t border-divider">
                <div className="text-[10.5px] uppercase tracking-[0.06em] font-semibold text-ink-muted mb-3">
                  Cost by agent · all time
                </div>
                <div className="space-y-2">
                  {data.cost_estimate.by_agent.map(a => (
                    <AgentBar
                      key={a.agent}
                      agent={a.agent}
                      calls={a.calls}
                      totalEur={a.total_eur}
                      maxEur={Math.max(...data.cost_estimate.by_agent.map(x => x.total_eur)) || 1}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ═══════════ QUALITY KPIs ═══════════ */}
      <section className="mb-8">
        <h2 className="text-[16px] font-semibold text-ink tracking-tight mb-3">Classifier quality</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <BigKPI
            label="Extraction accuracy"
            value={exAcc != null ? `${exAcc.toFixed(1)}%` : '—'}
            target={`Target ${data.extraction.target_pct}%`}
            good={exAcc != null && exAcc >= data.extraction.target_pct}
            subtitle={`${data.extraction.total_invoices} invoices · ${data.extraction.corrected} corrected`}
          />
          <BigKPI
            label="Classification accuracy"
            value={clAcc != null ? `${clAcc.toFixed(1)}%` : '—'}
            target={`Target ${data.classification.target_pct}%`}
            good={clAcc != null && clAcc >= data.classification.target_pct}
            subtitle={`${data.classification.total_lines} lines · ${data.classification.changed_by_user} changed`}
          />
          <BigKPI
            label="Total Anthropic calls"
            value={String(data.cost_estimate.anthropic_api_calls)}
            target={data.cost_estimate.total_tokens ? `${(data.cost_estimate.total_tokens / 1000).toFixed(1)}k tokens` : ''}
            good={true}
            subtitle={data.cost_estimate.is_real ? 'from api_calls log' : data.cost_estimate.note}
          />
        </div>
      </section>

      {/* ═══════════ BREAKDOWNS ═══════════ */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Classification source split */}
        <Card title="Classification source · all time">
          {totalSource === 0 ? (
            <EmptyLine>No classified lines yet.</EmptyLine>
          ) : (
            <div className="space-y-2">
              <SourceBar label="Rule"       value={data.classification.by_source.rule}       total={totalSource} tone="success" />
              <SourceBar label="Precedent"  value={data.classification.by_source.precedent}  total={totalSource} tone="info" />
              <SourceBar label="Inference"  value={data.classification.by_source.inference}  total={totalSource} tone="warning" />
              <SourceBar label="Manual"     value={data.classification.by_source.manual}     total={totalSource} tone="brand" />
            </div>
          )}
        </Card>

        {/* Declarations by status */}
        <Card title="Declarations by status">
          {data.declarations_by_status.length === 0 ? (
            <EmptyLine>No declarations yet.</EmptyLine>
          ) : (
            <div className="space-y-1.5">
              {data.declarations_by_status.map(s => (
                <div key={s.status} className="flex items-center justify-between text-[12.5px]">
                  <span className="capitalize text-ink-soft">{s.status}</span>
                  <span className="tabular-nums font-semibold text-ink">{s.n}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Rule frequency — full-width on md */}
        <Card title="Rules by frequency · top 15" className="md:col-span-2">
          {data.classification.by_rule.length === 0 ? (
            <EmptyLine>No rule fires yet.</EmptyLine>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
              {data.classification.by_rule.slice(0, 15).map(r => (
                <div key={r.classification_rule} className="flex items-center justify-between text-[12px] border-b border-divider last:border-0 py-1.5">
                  <span className="font-mono text-[11px] text-ink-soft">{r.classification_rule}</span>
                  <span className="tabular-nums text-ink-muted">{r.n}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}

// ═══════════════ Sub-components ═══════════════

function Banner({
  tone, icon, children,
}: { tone: 'danger' | 'warning'; icon: React.ReactNode; children: React.ReactNode }) {
  const classes =
    tone === 'danger'
      ? 'border-danger-500/40 bg-danger-50 text-danger-700'
      : 'border-brand-300/50 bg-brand-50 text-brand-800';
  return (
    <div className={`mb-4 rounded-xl border px-4 py-3 flex items-start gap-3 ${classes}`}>
      <span className="shrink-0 mt-0.5">{icon}</span>
      <div className="text-[12.5px] leading-relaxed">{children}</div>
    </div>
  );
}

function AgentBar({
  agent, calls, totalEur, maxEur,
}: { agent: string; calls: number; totalEur: number; maxEur: number }) {
  const pct = maxEur > 0 ? (totalEur / maxEur) * 100 : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between text-[12px] mb-1">
        <span className="font-medium text-ink">{agent}</span>
        <span className="text-ink-muted tabular-nums">
          €{totalEur.toFixed(2)} · {calls} call{calls === 1 ? '' : 's'}
        </span>
      </div>
      <div className="h-1.5 w-full bg-surface-alt rounded-full overflow-hidden">
        <div
          className="h-full bg-brand-500/80 rounded-full"
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  );
}

function DailySparkline({ days }: { days: Array<{ d: string; eur: number; calls: number }> }) {
  const max = Math.max(...days.map(d => d.eur), 0.01);
  return (
    <div className="flex items-end gap-[2px] h-16 w-full">
      {days.map(day => {
        const h = Math.max(2, (day.eur / max) * 100);
        return (
          <div
            key={day.d}
            className="flex-1 bg-brand-500/70 hover:bg-brand-600 rounded-sm transition-colors relative group min-w-[4px]"
            style={{ height: `${h}%` }}
            title={`${day.d}: €${day.eur.toFixed(2)} · ${day.calls} call${day.calls === 1 ? '' : 's'}`}
          >
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-ink text-white text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
              {day.d.slice(5)} · €{day.eur.toFixed(2)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SourceBar({
  label, value, total, tone,
}: {
  label: string; value: number; total: number;
  tone: 'success' | 'info' | 'warning' | 'brand';
}) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  const fillColor =
    tone === 'success' ? 'bg-success-500' :
    tone === 'info'    ? 'bg-info-500'    :
    tone === 'warning' ? 'bg-warning-500' :
                         'bg-brand-500';
  return (
    <div>
      <div className="flex items-baseline justify-between text-[12px] mb-1">
        <span className="text-ink-soft">{label}</span>
        <span className="tabular-nums text-ink-muted">
          {value} <span className="text-ink-faint">({pct.toFixed(0)}%)</span>
        </span>
      </div>
      <div className="h-1.5 w-full bg-surface-alt rounded-full overflow-hidden">
        <div className={`h-full ${fillColor} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function BigKPI({
  label, value, target, good, subtitle,
}: {
  label: string; value: string; target?: string;
  good: boolean; subtitle: string;
}) {
  return (
    <div className="bg-surface border border-border rounded-xl p-5 shadow-xs">
      <div className="flex items-center justify-between">
        <div className="text-[10.5px] uppercase tracking-[0.06em] font-semibold text-ink-muted">{label}</div>
        {target && (
          <Badge tone={good ? 'success' : 'warning'}>{good ? 'on target' : 'below target'}</Badge>
        )}
      </div>
      <div className="text-[32px] font-bold text-ink tabular-nums mt-2 tracking-tight leading-none" style={{ letterSpacing: '-0.02em' }}>
        {value}
      </div>
      {target && <div className="text-[11px] text-ink-muted mt-1">{target}</div>}
      <div className="text-[11.5px] text-ink-soft mt-2 leading-relaxed">{subtitle}</div>
    </div>
  );
}

function Card({
  title, children, className = '',
}: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-surface border border-border rounded-xl shadow-xs overflow-hidden ${className}`}>
      <header className="px-4 py-3 border-b border-divider">
        <h3 className="text-[13px] font-semibold text-ink tracking-tight">{title}</h3>
      </header>
      <div className="p-4">{children}</div>
    </div>
  );
}

function EmptyLine({ children }: { children: React.ReactNode }) {
  return <div className="text-[12px] text-ink-muted">{children}</div>;
}
