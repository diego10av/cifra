'use client';

// ════════════════════════════════════════════════════════════════════════
// /settings/logs — admin view of recent error + warn records.
//
// Cheap Sentry stand-in: surfaces the structured logger output from the
// app_logs table so Diego can see what's failing without opening Vercel's
// log drawer. Counters strip up top, filterable list below.
// ════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangleIcon, ActivityIcon, RefreshCwIcon, InfoIcon, XCircleIcon,
} from 'lucide-react';
import { PageSkeleton } from '@/components/ui/Skeleton';

interface LogRow {
  id: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  module: string | null;
  msg: string;
  fields: Record<string, unknown>;
  err_name: string | null;
  err_message: string | null;
  err_stack: string | null;
  created_at: string;
}

export default function LogsAdminPage() {
  const [logs, setLogs] = useState<LogRow[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [schemaMissing, setSchemaMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState<'all' | 'error' | 'warn'>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setError(null);
    try {
      const qs = level === 'all' ? '' : `?level=${level}`;
      const res = await fetch(`/api/logs${qs}`);
      const data = await res.json();
      if (data?.schema_missing) {
        setSchemaMissing(true);
        setLogs([]);
        return;
      }
      if (!res.ok) {
        setError(data?.error?.message ?? 'Failed to load logs.');
        setLogs([]);
        return;
      }
      setLogs(data.logs as LogRow[]);
      setCounts(data.counts_24h ?? {});
      setSchemaMissing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error.');
      setLogs([]);
    }
  }, [level]);

  useEffect(() => { load(); }, [load]);

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  if (logs === null) return <PageSkeleton />;

  return (
    <div>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] text-ink-faint mb-1">
            <Link href="/settings" className="hover:underline">Settings</Link> ›
          </div>
          <h1 className="text-[20px] font-semibold tracking-tight flex items-center gap-2">
            <ActivityIcon size={18} className="text-brand-500" /> Application logs
          </h1>
          <p className="text-[12.5px] text-ink-muted mt-1 max-w-xl">
            Error + warn entries captured by the structured logger.
            Retention is not automated — trim the table manually when needed.
          </p>
        </div>
        <button
          onClick={load}
          className="h-8 px-3 rounded-md border border-border-strong text-[12.5px] font-medium text-ink-soft hover:bg-surface-alt inline-flex items-center gap-1.5"
        >
          <RefreshCwIcon size={13} /> Refresh
        </button>
      </div>

      {schemaMissing && (
        <div className="mb-6 rounded-xl border border-warning-200 bg-gradient-to-br from-warning-50 to-surface p-5 flex items-start gap-4">
          <div className="w-9 h-9 rounded-lg bg-warning-500 text-white inline-flex items-center justify-center shrink-0">
            <AlertTriangleIcon size={16} />
          </div>
          <div>
            <h3 className="text-[14px] font-semibold text-ink">Migration not applied</h3>
            <p className="text-[12.5px] text-ink-soft mt-1 leading-relaxed">
              Apply <code className="text-[11.5px] bg-surface-alt px-1 py-0.5 rounded">migrations/003_app_logs.sql</code> to
              start persisting logs. Until then, errors live only in the Vercel log drawer
              (fine for dev, limiting for production triage).
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 text-[12px] text-danger-700 bg-danger-50 border border-danger-200 rounded px-3 py-2">
          {error}
        </div>
      )}

      {/* Counter strip (24h) */}
      {!schemaMissing && (
        <div className="grid grid-cols-3 gap-2 mb-5">
          <Counter label="Errors (24h)" count={counts.error ?? 0} tone="danger" />
          <Counter label="Warnings (24h)" count={counts.warn ?? 0} tone="amber" />
          <Counter label="Info (24h)" count={counts.info ?? 0} tone="neutral" />
        </div>
      )}

      {/* Level filter */}
      {!schemaMissing && (
        <div className="mb-3 flex items-center gap-1.5">
          <FilterChip label="All" active={level === 'all'} onClick={() => setLevel('all')} />
          <FilterChip label="Errors" active={level === 'error'} onClick={() => setLevel('error')} tone="danger" />
          <FilterChip label="Warnings" active={level === 'warn'} onClick={() => setLevel('warn')} tone="amber" />
        </div>
      )}

      {/* List */}
      {!schemaMissing && logs.length === 0 && (
        <div className="bg-surface border border-border rounded-lg p-8 text-center">
          <div className="w-10 h-10 mx-auto rounded-lg bg-emerald-50 text-emerald-700 inline-flex items-center justify-center mb-3">
            <InfoIcon size={16} />
          </div>
          <div className="text-[13px] font-medium text-ink">All quiet</div>
          <div className="text-[11.5px] text-ink-muted mt-1.5 max-w-sm mx-auto">
            No error or warning records in the current view. Good sign.
          </div>
        </div>
      )}

      {!schemaMissing && logs.length > 0 && (
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <ul className="divide-y divide-divider">
            {logs.map((log) => (
              <li key={log.id} className="px-4 py-3">
                <LogItem log={log} expanded={expanded.has(log.id)} onToggle={() => toggleExpand(log.id)} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function LogItem({
  log, expanded, onToggle,
}: { log: LogRow; expanded: boolean; onToggle: () => void }) {
  const when = new Date(log.created_at);
  const hasFields = log.fields && Object.keys(log.fields).length > 0;
  const hasStack = !!log.err_stack;

  return (
    <div>
      <button onClick={onToggle} className="w-full text-left">
        <div className="flex items-start gap-2">
          <LevelBadge level={log.level} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {log.module && (
                <span className="text-[10.5px] font-mono text-brand-700 bg-brand-50 border border-brand-100 rounded px-1.5 py-0.5">
                  {log.module}
                </span>
              )}
              <span className="text-[10.5px] text-ink-faint">
                {when.toLocaleString('en-GB', {
                  day: '2-digit', month: 'short',
                  hour: '2-digit', minute: '2-digit', second: '2-digit',
                })}
              </span>
            </div>
            <div className="text-[13px] text-ink mt-1 break-words">{log.msg}</div>
            {log.err_message && (
              <div className="text-[12px] text-danger-700 mt-1 font-mono break-words">
                {log.err_name ? `${log.err_name}: ` : ''}{log.err_message}
              </div>
            )}
          </div>
          {(hasFields || hasStack) && (
            <span className="text-[10.5px] text-ink-muted shrink-0 mt-1">
              {expanded ? 'hide' : 'expand'}
            </span>
          )}
        </div>
      </button>

      {expanded && (
        <div className="mt-2 pl-7 space-y-2">
          {hasFields && (
            <div>
              <div className="text-[10px] uppercase tracking-wide font-semibold text-ink-muted mb-0.5">Fields</div>
              <pre className="text-[11px] font-mono bg-surface-alt border border-border rounded px-3 py-2 overflow-x-auto whitespace-pre-wrap break-words">
                {JSON.stringify(log.fields, null, 2)}
              </pre>
            </div>
          )}
          {hasStack && (
            <div>
              <div className="text-[10px] uppercase tracking-wide font-semibold text-ink-muted mb-0.5">Stack</div>
              <pre className="text-[11px] font-mono bg-surface-alt border border-border rounded px-3 py-2 overflow-x-auto whitespace-pre-wrap break-words">
                {log.err_stack}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LevelBadge({ level }: { level: LogRow['level'] }) {
  const colours: Record<LogRow['level'], string> = {
    debug: 'bg-surface-alt text-ink-muted border-border',
    info:  'bg-blue-50 text-blue-700 border-blue-200',
    warn:  'bg-amber-50 text-amber-700 border-amber-200',
    error: 'bg-danger-50 text-danger-700 border-danger-200',
  };
  return (
    <span className={`inline-flex items-center gap-1 h-5 px-1.5 rounded text-[10px] font-semibold uppercase tracking-wide border shrink-0 ${colours[level]}`}>
      {level === 'error' && <XCircleIcon size={10} />}
      {level}
    </span>
  );
}

function Counter({
  label, count, tone,
}: { label: string; count: number; tone: 'danger' | 'amber' | 'neutral' }) {
  const colours = {
    danger:  'bg-danger-50 text-danger-700 border-danger-100',
    amber:   'bg-amber-50 text-amber-700 border-amber-100',
    neutral: 'bg-surface border-border text-ink-soft',
  };
  return (
    <div className={`rounded-lg border p-3 ${colours[tone]}`}>
      <div className="text-[10.5px] uppercase tracking-wide font-semibold opacity-80">{label}</div>
      <div className="text-[22px] font-bold tabular-nums mt-0.5">{count}</div>
    </div>
  );
}

function FilterChip({
  label, active, onClick, tone = 'brand',
}: { label: string; active: boolean; onClick: () => void; tone?: 'brand' | 'danger' | 'amber' }) {
  const colours = {
    brand:  active ? 'bg-brand-50 text-brand-700 border-brand-200'   : 'bg-surface text-ink-soft border-border',
    danger: active ? 'bg-danger-50 text-danger-700 border-danger-200' : 'bg-surface text-ink-soft border-border',
    amber:  active ? 'bg-amber-50 text-amber-700 border-amber-200'   : 'bg-surface text-ink-soft border-border',
  };
  return (
    <button
      onClick={onClick}
      className={`h-7 px-3 rounded border text-[11.5px] font-medium hover:border-gray-400 transition-colors cursor-pointer ${colours[tone]}`}
    >
      {label}
    </button>
  );
}
