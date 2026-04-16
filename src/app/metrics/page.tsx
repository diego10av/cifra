'use client';

import { useEffect, useState } from 'react';

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
}

export default function MetricsPage() {
  const [data, setData] = useState<MetricsData | null>(null);

  useEffect(() => {
    fetch('/api/metrics').then(r => r.json()).then(setData);
  }, []);

  if (!data) return <div className="text-center py-12 text-ink-muted">Loading…</div>;

  const exAcc = data.extraction.accuracy_pct;
  const clAcc = data.classification.accuracy_pct;
  const totalSource = Object.values(data.classification.by_source).reduce((s, n) => s + n, 0);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[22px] font-semibold tracking-tight text-ink" style={{ letterSpacing: '-0.015em' }}>Quality metrics</h1>
        <p className="text-[12.5px] text-ink-muted mt-1.5">
          Accuracy of the AI agents and the rules engine, derived from the audit log. Per PRD §17.4.
        </p>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-4 gap-3 mb-5">
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
          label={data.cost_estimate.is_real ? 'Anthropic spend (actual)' : 'Anthropic spend (est.)'}
          value={`€${data.cost_estimate.anthropic_eur.toFixed(data.cost_estimate.anthropic_eur < 1 ? 4 : 2)}`}
          subtitle={`${data.cost_estimate.anthropic_api_calls.toLocaleString()} API call${data.cost_estimate.anthropic_api_calls === 1 ? '' : 's'}${data.cost_estimate.total_tokens ? ` · ${(data.cost_estimate.total_tokens / 1000).toFixed(1)}k tokens` : ''}`}
        />
        <BigKPI
          label="Active declarations"
          value={data.declarations_by_status.filter(d => !['paid'].includes(d.status)).reduce((s, d) => s + d.n, 0)}
          subtitle={`${data.declarations_by_status.find(d => d.status === 'paid')?.n || 0} paid (closed)`}
        />
      </div>

      {/* Two-column row */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        {/* Classification source split */}
        <div className="bg-surface border border-border rounded-lg p-4 shadow-xs">
          <h3 className="text-[13px] font-semibold text-ink mb-3 tracking-tight">Classification source</h3>
          {totalSource === 0 ? (
            <div className="text-[12px] text-ink-faint">No classified lines yet.</div>
          ) : (
            <div className="space-y-2">
              <SourceBar label="Rule" n={data.classification.by_source.rule} total={totalSource} color="bg-sky-400" />
              <SourceBar label="Precedent" n={data.classification.by_source.precedent} total={totalSource} color="bg-blue-400" />
              <SourceBar label="Inference" n={data.classification.by_source.inference} total={totalSource} color="bg-amber-400" />
              <SourceBar label="Manual" n={data.classification.by_source.manual} total={totalSource} color="bg-emerald-400" />
            </div>
          )}
        </div>

        {/* Declarations by status */}
        <div className="bg-surface border border-border rounded-lg p-4 shadow-xs">
          <h3 className="text-[13px] font-semibold text-ink mb-3 tracking-tight">Declarations by status</h3>
          <div className="space-y-2">
            {data.declarations_by_status.map(s => (
              <div key={s.status} className="flex items-center justify-between text-[12px]">
                <span className="text-ink-soft capitalize">{s.status}</span>
                <span className="font-semibold tabular-nums">{s.n}</span>
              </div>
            ))}
            {data.declarations_by_status.length === 0 && (
              <div className="text-[12px] text-ink-faint">No declarations yet.</div>
            )}
          </div>
        </div>
      </div>

      {/* Per-rule frequency */}
      <div className="bg-surface border border-border rounded-lg p-4 mb-5 shadow-xs">
        <h3 className="text-[13px] font-semibold text-ink mb-3 tracking-tight">Rules engine — usage</h3>
        {data.classification.by_rule.length === 0 ? (
          <div className="text-[12px] text-ink-faint">No rule applications yet.</div>
        ) : (
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
            {data.classification.by_rule.map(r => (
              <div key={r.classification_rule} className="flex items-center justify-between text-[12px] border-b border-divider pb-1">
                <span className="text-ink-soft font-mono">{r.classification_rule}</span>
                <span className="font-semibold tabular-nums">{r.n}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Spend by agent */}
      {data.cost_estimate.is_real && data.cost_estimate.by_agent.length > 0 && (
        <div className="bg-surface border border-border rounded-lg p-4 mb-5 shadow-xs">
          <h3 className="text-[13px] font-semibold text-ink mb-3 tracking-tight">Spend by agent</h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
            {data.cost_estimate.by_agent.map(a => (
              <div key={a.agent} className="flex items-center justify-between text-[12px] border-b border-divider pb-1">
                <span className="text-ink-soft capitalize">{a.agent.replace('_', ' ')}</span>
                <div className="flex items-center gap-3">
                  <span className="text-ink-muted text-[11px]">{a.calls} calls</span>
                  <span className="font-semibold tabular-nums">€{a.total_eur.toFixed(a.total_eur < 1 ? 4 : 2)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activity sparkline */}
      <div className="bg-surface border border-border rounded-lg p-4 mb-5 shadow-xs">
        <h3 className="text-[13px] font-semibold text-ink mb-3 tracking-tight">Activity, last 30 days</h3>
        {data.activity_last_30d.length === 0 ? (
          <div className="text-[12px] text-ink-faint">No activity in the last 30 days.</div>
        ) : (
          <ActivitySparkline data={data.activity_last_30d} />
        )}
      </div>

      <div className="text-[11px] text-ink-faint">{data.cost_estimate.note}</div>
    </div>
  );
}

function BigKPI({ label, value, subtitle, target, good }: {
  label: string; value: string | number; subtitle?: string; target?: string; good?: boolean;
}) {
  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      <div className="text-[10px] text-ink-muted uppercase tracking-wide font-semibold">{label}</div>
      <div className={`text-3xl font-bold mt-1 tabular-nums ${good === true ? 'text-emerald-600' : good === false ? 'text-amber-600' : 'text-ink'}`}>
        {value}
      </div>
      {target && <div className="text-[10px] text-ink-faint mt-0.5">{target}</div>}
      {subtitle && <div className="text-[11px] text-ink-muted mt-1">{subtitle}</div>}
    </div>
  );
}

function SourceBar({ label, n, total, color }: { label: string; n: number; total: number; color: string }) {
  const pct = total > 0 ? (n / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] mb-0.5">
        <span className="text-ink-soft">{label}</span>
        <span className="text-ink-muted tabular-nums">{n} ({pct.toFixed(0)}%)</span>
      </div>
      <div className="h-2 bg-surface-alt rounded overflow-hidden">
        <div className={`h-full ${color} transition-all duration-300`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ActivitySparkline({ data }: { data: { d: string; n: number }[] }) {
  const max = Math.max(...data.map(d => d.n), 1);
  return (
    <div className="flex items-end gap-0.5 h-20">
      {data.map(d => (
        <div key={d.d} className="flex-1 flex flex-col items-center group" title={`${d.d}: ${d.n} events`}>
          <div className="w-full bg-brand-500 rounded-sm transition-all duration-150 group-hover:bg-brand-500"
            style={{ height: `${Math.max(2, (d.n / max) * 100)}%` }} />
        </div>
      ))}
    </div>
  );
}
