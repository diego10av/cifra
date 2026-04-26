'use client';

// ════════════════════════════════════════════════════════════════════════
// AuditTrailPanel — the "defensible paper trail" tab for a declaration.
//
// Why this exists (per Diego's customer discovery 2026-04-18):
//
//   Two potential customers said the single most important thing in
//   a product like this is a visible, exportable log of every change
//   — *especially* the ones where the human overrode what the AI
//   suggested. In their words: "cuando tengamos una auditoría, esto
//   nos salva la vida".
//
//   cifra's positioning answer:
//
//       "The AI doesn't take the final call — you do. And every time
//        you disagree with cifra, we log it with timestamp, reason,
//        and the AI's original suggestion. In 3 years, when the AED
//        asks you 'why did you classify this line as LUX_17 instead
//        of EXEMPT_44 in Q2 2024', you have a one-click PDF that says
//        so with citations."
//
// Design:
//   - Top bar: summary counts + "Export PDF" button.
//   - Filter pills: All / AI overrides / Treatments / Other.
//   - Vertical timeline of events, newest first.
//   - AI-override events get a prominent visual treatment — coloured
//     left border, "AI override" pill, and an inline diff of "cifra
//     suggested X → you decided Y", plus the reason the user typed
//     at the moment of the override.
//   - Non-override events are rendered compactly (one line each) to
//     not drown the signal.
// ════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ShieldCheckIcon, AlertTriangleIcon, DownloadIcon, FilterIcon,
  ClockIcon, UserIcon, FileTextIcon, ArrowRightIcon,
  CheckCircle2Icon, PencilIcon, Loader2Icon,
} from 'lucide-react';

type Filter = 'all' | 'overrides' | 'treatments' | 'other';

interface AuditEvent {
  id: string;
  created_at: string;
  user_id: string | null;
  action: string;
  target_type: string;
  target_id: string;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  reason: string | null;
  line_description: string | null;
  line_provider: string | null;
  ai_suggested_treatment: string | null;
  ai_suggested_rule: string | null;
  is_ai_override: boolean;
}

interface Summary {
  total: number;
  ai_overrides: number;
  treatment_changes: number;
  other: number;
}

export function AuditTrailPanel({ declarationId }: { declarationId: string }) {
  const [events, setEvents] = useState<AuditEvent[] | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/declarations/${declarationId}/audit-log`);
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message ?? 'Failed to load audit log.');
        setEvents([]);
        return;
      }
      setEvents(data.events as AuditEvent[]);
      setSummary(data.summary as Summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error.');
      setEvents([]);
    }
  }, [declarationId]);

  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => {
    if (!events) return [];
    switch (filter) {
      case 'overrides':  return events.filter(e => e.is_ai_override);
      case 'treatments': return events.filter(e => e.target_type === 'invoice_line' && e.field === 'treatment');
      case 'other':      return events.filter(e => !(e.target_type === 'invoice_line' && e.field === 'treatment'));
      default:           return events;
    }
  }, [events, filter]);

  if (events === null) {
    return (
      <div className="p-10 text-center text-sm text-ink-muted">
        <Loader2Icon className="inline-block animate-spin mr-2" size={14} />
        Loading audit trail…
      </div>
    );
  }

  return (
    <div className="pr-3">
      {/* ─── Header: summary + export ─── */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h2 className="text-base font-semibold text-ink tracking-tight flex items-center gap-2">
            <ShieldCheckIcon size={16} className="text-brand-600" />
            Audit trail
          </h2>
          <p className="text-xs text-ink-muted mt-1 max-w-xl leading-relaxed">
            Every change that&rsquo;s happened on this declaration — edits,
            treatment overrides, status transitions — with timestamps
            and the reason you gave at the moment. Defensible evidence
            that <strong>you</strong> made the final call, not the AI.
          </p>
        </div>
        <div className="shrink-0 flex gap-2">
          <a
            href={`/api/declarations/${declarationId}/audit-log.csv`}
            className="h-9 px-3.5 rounded-md border border-border-strong text-sm font-medium text-ink-soft hover:bg-surface-alt hover:text-ink transition-colors inline-flex items-center gap-1.5"
            title="Download as CSV for accounting / reconciliation"
          >
            <DownloadIcon size={14} /> CSV
          </a>
          <a
            href={`/api/declarations/${declarationId}/audit-log.pdf`}
            target="_blank"
            rel="noreferrer"
            className="h-9 px-3.5 rounded-md bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 transition-colors inline-flex items-center gap-1.5"
            title="Formal audit PDF for AED defence + retention"
          >
            <DownloadIcon size={14} /> PDF
          </a>
        </div>
      </div>

      {/* ─── Summary stats ─── */}
      {summary && (
        <div className="grid grid-cols-4 gap-2 mb-4">
          <SumBox label="Total events" value={summary.total}    tone="neutral" />
          <SumBox label="AI overrides"  value={summary.ai_overrides} tone="warning" />
          <SumBox label="Treatment edits" value={summary.treatment_changes} tone="neutral" />
          <SumBox label="Other changes" value={summary.other}    tone="neutral" />
        </div>
      )}

      {/* ─── Filter pills ─── */}
      <div className="flex items-center gap-1.5 mb-4">
        <FilterIcon size={12} className="text-ink-muted mr-1" />
        <FilterPill label="All"          count={summary?.total ?? 0}              active={filter === 'all'}        onClick={() => setFilter('all')} />
        <FilterPill label="AI overrides" count={summary?.ai_overrides ?? 0}       active={filter === 'overrides'}  onClick={() => setFilter('overrides')} highlight />
        <FilterPill label="Treatments"   count={summary?.treatment_changes ?? 0}  active={filter === 'treatments'} onClick={() => setFilter('treatments')} />
        <FilterPill label="Other"        count={summary?.other ?? 0}              active={filter === 'other'}      onClick={() => setFilter('other')} />
      </div>

      {error && (
        <div className="mb-3 text-sm text-danger-700 bg-danger-50 border border-danger-200 rounded px-3 py-2">
          {error}
        </div>
      )}

      {/* ─── Timeline ─── */}
      {visible.length === 0 ? (
        <div className="bg-surface border border-border rounded-lg p-10 text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-emerald-50 text-emerald-600 inline-flex items-center justify-center mb-3">
            <CheckCircle2Icon size={20} />
          </div>
          <div className="text-sm font-medium text-ink">
            {filter === 'overrides'
              ? 'No AI overrides yet'
              : filter === 'treatments'
              ? 'No treatment changes yet'
              : filter === 'other'
              ? 'No other changes yet'
              : 'No activity yet'}
          </div>
          <div className="text-xs text-ink-muted mt-1.5 max-w-sm mx-auto leading-relaxed">
            {filter === 'overrides'
              ? 'When you disagree with cifra\u2019s classification and change a treatment, it\u2019ll show up here with the original suggestion and your reason.'
              : 'Edits and status transitions will appear here as soon as they happen.'}
          </div>
        </div>
      ) : (
        <ol className="relative space-y-2">
          {visible.map((ev) => (
            <li key={ev.id}>
              <EventRow event={ev} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// ─────────────────────────── subcomponents ───────────────────────────

function SumBox({ label, value, tone }: { label: string; value: number; tone: 'neutral' | 'warning' }) {
  const cls = tone === 'warning'
    ? 'bg-warning-50 border-warning-200 text-warning-800'
    : 'bg-surface border-border text-ink';
  return (
    <div className={`rounded-lg border p-3 ${cls}`}>
      <div className="text-2xs uppercase tracking-wide font-semibold opacity-70">{label}</div>
      <div className="text-lg font-bold tabular-nums mt-0.5" style={{ letterSpacing: '-0.01em' }}>
        {value}
      </div>
    </div>
  );
}

function FilterPill({
  label, count, active, onClick, highlight,
}: { label: string; count: number; active: boolean; onClick: () => void; highlight?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={[
        'h-7 px-2.5 rounded-md text-xs font-medium border transition-colors inline-flex items-center gap-1.5',
        active
          ? highlight
            ? 'bg-warning-100 text-warning-800 border-warning-300'
            : 'bg-brand-50 text-brand-700 border-brand-200'
          : 'bg-surface text-ink-soft border-border hover:bg-surface-alt',
      ].join(' ')}
    >
      {label}
      {count > 0 && (
        <span className={`text-2xs tabular-nums ${active ? 'font-bold' : 'text-ink-faint'}`}>
          {count}
        </span>
      )}
    </button>
  );
}

function EventRow({ event }: { event: AuditEvent }) {
  const date = new Date(event.created_at);
  const timeStr = date.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });

  if (event.is_ai_override) {
    return <AiOverrideRow event={event} timeStr={timeStr} />;
  }
  return <CompactRow event={event} timeStr={timeStr} />;
}

function AiOverrideRow({ event, timeStr }: { event: AuditEvent; timeStr: string }) {
  const ai = event.ai_suggested_treatment ?? '—';
  const rule = event.ai_suggested_rule;
  const user = event.new_value ?? '—';
  const who = event.user_id ?? 'founder';
  const lineLabel = event.line_description || event.line_provider || 'line';

  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden">
      <div className="border-l-4 border-warning-500 pl-4 pr-4 py-3">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-md bg-warning-50 text-warning-700 inline-flex items-center justify-center shrink-0 mt-0.5">
            <AlertTriangleIcon size={14} />
          </div>
          <div className="flex-1 min-w-0">
            {/* Top row: timestamp, user, override badge */}
            <div className="flex items-center gap-2 flex-wrap text-xs text-ink-muted">
              <span className="inline-flex items-center gap-1">
                <ClockIcon size={10} /> {timeStr}
              </span>
              <span className="text-ink-faint">·</span>
              <span className="inline-flex items-center gap-1">
                <UserIcon size={10} /> {who}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-warning-100 text-warning-800 text-2xs uppercase tracking-wider font-bold">
                AI override
              </span>
            </div>

            {/* The override: cifra → you */}
            <div className="mt-2 flex items-center gap-2 flex-wrap text-sm">
              <span className="text-ink-muted">cifra suggested</span>
              <code className="px-1.5 py-0.5 rounded bg-surface-alt text-ink font-mono text-xs border border-border">
                {ai}
              </code>
              {rule && (
                <span className="text-2xs text-ink-faint font-mono">
                  ({rule})
                </span>
              )}
              <ArrowRightIcon size={14} className="text-ink-muted mx-0.5" />
              <span className="text-ink-muted">you changed to</span>
              <code className="px-1.5 py-0.5 rounded bg-brand-50 text-brand-700 font-mono text-xs font-semibold border border-brand-200">
                {user}
              </code>
            </div>

            {/* Line context */}
            <div className="mt-2 text-xs text-ink-soft flex items-center gap-1.5">
              <FileTextIcon size={11} className="text-ink-faint" />
              <span className="font-medium">{event.line_provider ?? '—'}</span>
              <span className="text-ink-faint">·</span>
              <span className="truncate">{lineLabel}</span>
            </div>

            {/* Reason (if given) */}
            {event.reason ? (
              <div className="mt-2 text-sm text-ink bg-surface-alt/50 border-l-2 border-brand-300 pl-3 py-1.5 italic">
                &ldquo;{event.reason}&rdquo;
              </div>
            ) : (
              <div className="mt-1.5 text-xs text-ink-faint italic">
                (no reason provided)
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CompactRow({ event, timeStr }: { event: AuditEvent; timeStr: string }) {
  const who = event.user_id ?? 'founder';
  const icon = iconFor(event);
  const title = describeEvent(event);
  const lineLabel = event.line_provider || event.line_description;

  return (
    <div className="flex items-start gap-3 px-4 py-2.5 bg-surface border border-border rounded-lg">
      <div className="w-7 h-7 rounded-md bg-surface-alt text-ink-soft inline-flex items-center justify-center shrink-0 mt-0.5">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-ink leading-snug">{title}</div>
        <div className="flex items-center gap-2 mt-0.5 text-2xs text-ink-muted">
          <span>{timeStr}</span>
          <span className="text-ink-faint">·</span>
          <span>{who}</span>
          {lineLabel && (
            <>
              <span className="text-ink-faint">·</span>
              <span className="truncate">{lineLabel}</span>
            </>
          )}
        </div>
        {event.reason && (
          <div className="mt-1 text-xs text-ink-soft italic">&ldquo;{event.reason}&rdquo;</div>
        )}
      </div>
    </div>
  );
}

function iconFor(event: AuditEvent) {
  const size = 12;
  if (event.action === 'approve' || event.action === 'file' || event.action === 'pay') {
    return <CheckCircle2Icon size={size} />;
  }
  if (event.target_type === 'invoice_line' || event.target_type === 'invoice') {
    return <PencilIcon size={size} />;
  }
  return <FileTextIcon size={size} />;
}

function describeEvent(event: AuditEvent): string {
  const field = event.field ?? '';
  const from = event.old_value || '(empty)';
  const to   = event.new_value || '(empty)';

  if (event.target_type === 'invoice_line' && field) {
    return `Changed line ${field}: ${from} \u2192 ${to}`;
  }
  if (event.target_type === 'invoice' && field) {
    return `Changed invoice ${field}: ${from} \u2192 ${to}`;
  }
  if (event.target_type === 'declaration') {
    if (event.action === 'approve') return 'Approved declaration';
    if (event.action === 'file')    return 'Marked declaration as filed';
    if (event.action === 'pay')     return 'Marked declaration as paid';
    return `Declaration ${event.action}${field ? ` (${field})` : ''}`;
  }
  return `${event.action} ${event.target_type}${field ? ` · ${field}` : ''}`;
}
