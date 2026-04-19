'use client';

// ════════════════════════════════════════════════════════════════════════
// /settings/classifier — classifier accuracy dashboard.
//
// The "is the brain of cifra still OK?" panel. Runs the 60-fixture
// synthetic corpus through the deterministic classifier live and
// shows pass rate, broken down by archetype, with a drill-down list
// of any failing fixtures.
//
// Critical when we:
//   - swap Claude models (Haiku 4.5 → 5, etc) — classifier is
//     deterministic but shares infra; seeing 60/60 here means the
//     rules engine is intact
//   - add new rules (make sure we didn't regress existing ones)
//   - extend the corpus (a failure could mean the new fixture is
//     right and the rule is wrong — decision surface)
// ════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react';
import NextLink from 'next/link';
import {
  ShieldCheckIcon, AlertTriangleIcon, RefreshCwIcon, CheckCircle2Icon,
  XCircleIcon, ClockIcon, GitCommitIcon,
} from 'lucide-react';
import { PageSkeleton } from '@/components/ui/Skeleton';

interface Report {
  total: number;
  passed: number;
  failed: number;
  accuracy: number;
  duration_ms: number;
  rules_exercised: string[];
  archetypes: Array<{ archetype: string; count: number; passed: number }>;
  failures: Array<{
    id: string;
    title: string;
    expected_treatment: string | null;
    got_treatment: string | null;
    expected_rule: string;
    got_rule: string;
    legal_ref?: string;
  }>;
  generated_at: string;
  version: { commit: string | null; env: string };
}

export default function ClassifierAccuracyPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [reloading, setReloading] = useState(false);

  const load = useCallback(async () => {
    setReloading(true);
    try {
      const res = await fetch('/api/metrics/classifier', { cache: 'no-store' });
      const data = await res.json();
      if (res.ok) setReport(data as Report);
    } finally { setReloading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (!report) return <PageSkeleton />;

  const pct = (report.accuracy * 100).toFixed(1);
  const isPerfect = report.failed === 0;
  const headlineTone = isPerfect ? 'emerald' : report.accuracy >= 0.95 ? 'warning' : 'danger';

  return (
    <div>
      {/* Breadcrumb */}
      <div className="text-[11px] text-ink-faint mb-1">
        <NextLink href="/settings" className="hover:underline">Settings</NextLink> ›
      </div>

      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-semibold tracking-tight flex items-center gap-2">
            <ShieldCheckIcon size={18} className="text-brand-600" />
            Classifier accuracy
          </h1>
          <p className="text-[12.5px] text-ink-muted mt-1 max-w-2xl leading-relaxed">
            cifra&rsquo;s deterministic LTVA/CJEU rules engine run against the
            synthetic corpus of edge-case invoices. 100% pass rate = the
            brain is intact. Anything less and we investigate before
            the next declaration is filed.
          </p>
        </div>
        <button
          onClick={load}
          disabled={reloading}
          className="h-9 px-3 rounded-md border border-border-strong text-[12px] font-medium text-ink-soft hover:bg-surface-alt disabled:opacity-50 inline-flex items-center gap-1.5"
        >
          <RefreshCwIcon size={13} className={reloading ? 'animate-spin' : ''} /> Re-run
        </button>
      </div>

      {/* Headline */}
      <div className={[
        'rounded-xl border p-5 mb-5 flex items-center gap-5',
        headlineTone === 'emerald' ? 'bg-emerald-50 border-emerald-200' :
        headlineTone === 'warning' ? 'bg-warning-50 border-warning-200' :
                                       'bg-danger-50 border-danger-200',
      ].join(' ')}>
        <div className={[
          'w-14 h-14 rounded-lg inline-flex items-center justify-center shrink-0',
          headlineTone === 'emerald' ? 'bg-emerald-100 text-emerald-700' :
          headlineTone === 'warning' ? 'bg-warning-100 text-warning-700' :
                                         'bg-danger-100 text-danger-700',
        ].join(' ')}>
          {isPerfect ? <CheckCircle2Icon size={26} /> : <AlertTriangleIcon size={26} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[28px] font-bold tabular-nums text-ink leading-none" style={{ letterSpacing: '-0.02em' }}>
            {report.passed}/{report.total}
            <span className="text-[14px] text-ink-soft font-semibold ml-2">({pct}%)</span>
          </div>
          <div className="text-[12.5px] text-ink-soft mt-1.5">
            {isPerfect
              ? 'Every fixture passes. The classifier is behaving exactly as designed.'
              : `${report.failed} fixture${report.failed === 1 ? '' : 's'} failing. See details below.`}
          </div>
          <div className="mt-2 flex items-center gap-3 text-[11px] text-ink-muted">
            <span className="inline-flex items-center gap-1"><ClockIcon size={10} /> {report.duration_ms}ms</span>
            {report.version.commit && (
              <>
                <span className="text-ink-faint">·</span>
                <span className="inline-flex items-center gap-1 font-mono">
                  <GitCommitIcon size={10} /> {report.version.commit.slice(0, 7)}
                </span>
              </>
            )}
            <span className="text-ink-faint">·</span>
            <span className="inline-flex items-center gap-1">
              {report.rules_exercised.length} rules exercised
            </span>
          </div>
        </div>
      </div>

      {/* Archetypes breakdown */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden mb-5">
        <div className="px-4 py-2.5 border-b border-border bg-surface-alt/60">
          <h3 className="text-[13px] font-semibold text-ink">By archetype</h3>
          <p className="text-[11px] text-ink-muted mt-0.5">
            Fixture categories correspond to the real-world invoice types cifra sees in LU fund files.
          </p>
        </div>
        <div className="divide-y divide-divider">
          {report.archetypes.map(a => {
            const archPct = a.count === 0 ? 100 : (a.passed / a.count) * 100;
            const archOk = a.passed === a.count;
            return (
              <div key={a.archetype} className="px-4 py-2.5 flex items-center gap-3 text-[12.5px]">
                <span className="flex-1 font-medium text-ink truncate">{a.archetype}</span>
                <span className="text-[11px] text-ink-muted tabular-nums w-16 text-right">
                  {a.passed}/{a.count}
                </span>
                <div className="w-40 h-1.5 rounded-full bg-surface-alt overflow-hidden">
                  <div
                    className={`h-full transition-all ${archOk ? 'bg-emerald-500' : 'bg-warning-500'}`}
                    style={{ width: `${archPct}%` }}
                  />
                </div>
                <span className={`text-[10.5px] tabular-nums w-12 text-right font-semibold ${archOk ? 'text-emerald-700' : 'text-warning-700'}`}>
                  {archPct.toFixed(0)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Failures */}
      {report.failures.length > 0 && (
        <div className="bg-surface border border-danger-200 rounded-xl overflow-hidden mb-5">
          <div className="px-4 py-2.5 border-b border-danger-200 bg-danger-50">
            <h3 className="text-[13px] font-semibold text-danger-800 flex items-center gap-1.5">
              <XCircleIcon size={13} /> Failing fixtures ({report.failures.length})
            </h3>
            <p className="text-[11px] text-danger-700 mt-0.5">
              Each row is a concrete VAT scenario the classifier gets wrong. Fix either the rule or the fixture.
            </p>
          </div>
          <div className="divide-y divide-divider">
            {report.failures.map(f => (
              <div key={f.id} className="px-4 py-3 text-[12px]">
                <div className="flex items-center gap-2 mb-1">
                  <code className="text-[10.5px] bg-surface-alt px-1 py-0.5 rounded font-mono font-semibold">{f.id}</code>
                  <span className="font-medium text-ink">{f.title}</span>
                  {f.legal_ref && (
                    <span className="ml-auto text-[10px] text-ink-muted italic">{f.legal_ref}</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3 text-[11px] mt-2">
                  <div className="bg-emerald-50 border border-emerald-200 rounded px-2 py-1.5">
                    <div className="text-[9.5px] font-semibold text-emerald-800 uppercase mb-0.5">Expected</div>
                    <code className="font-mono text-emerald-900">{f.expected_treatment ?? 'no match'}</code>
                    <span className="text-emerald-700 ml-1">({f.expected_rule})</span>
                  </div>
                  <div className="bg-danger-50 border border-danger-200 rounded px-2 py-1.5">
                    <div className="text-[9.5px] font-semibold text-danger-800 uppercase mb-0.5">Got</div>
                    <code className="font-mono text-danger-900">{f.got_treatment || '—'}</code>
                    <span className="text-danger-700 ml-1">({f.got_rule})</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rules exercised (collapsed-by-default-ish, just a compact grid) */}
      <div className="bg-surface border border-border rounded-xl p-4">
        <h3 className="text-[13px] font-semibold text-ink mb-2">Rules exercised</h3>
        <p className="text-[11px] text-ink-muted mb-3">
          Every RULE id the corpus touches. An entry missing here means we have the rule in code but no
          fixture — candidate for new corpus cases.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {report.rules_exercised.map(r => (
            <code key={r} className="text-[10.5px] font-mono bg-surface-alt px-1.5 py-0.5 rounded border border-border">
              {r}
            </code>
          ))}
        </div>
      </div>
    </div>
  );
}
