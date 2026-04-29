'use client';

// ════════════════════════════════════════════════════════════════════════
// AuditLogDrawer — stint 64.O
//
// Per-row "📜 History" drawer. Big4 tax partners always ask "who marked
// this as filed and when?" — cifra writes to audit_log on every mutation
// (since the early stints) but had no UI to surface that history. This
// drawer fixes that.
//
// Renders an immutable timeline of events from audit_log filtered by
// (target_type, target_id). Most-recent first. Each entry shows:
//   • the action verb ("Status changed", "Comments updated", …)
//   • who did it (user_id) and when (relative + absolute date)
//   • the new value (and old value when present)
//
// Uses the existing /api/audit endpoint (extended in 64.O to accept
// target_type + target_id filters).
// ════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';
import { Drawer } from '@/components/ui/Drawer';

interface AuditEntry {
  id: string;
  user_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** What kind of object this drawer is showing history for, e.g. 'tax_filing'. */
  targetType: string;
  /** Specific object id. */
  targetId: string;
  /** Optional human label shown in the subtitle, e.g. "VAT Q1 2025 · Acme SARL". */
  targetLabel?: string;
}

export function AuditLogDrawer({
  open, onClose, targetType, targetId, targetLabel,
}: Props) {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setEntries(null);
    setError(null);
    const ac = new AbortController();
    const url = `/api/audit?target_type=${encodeURIComponent(targetType)}&target_id=${encodeURIComponent(targetId)}&limit=200`;
    fetch(url, { signal: ac.signal })
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then((body: { rows: AuditEntry[] }) => setEntries(body.rows ?? []))
      .catch((e: Error) => {
        if (e.name === 'AbortError') return;
        setError(e.message);
      });
    return () => ac.abort();
  }, [open, targetType, targetId]);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="📜 History"
      subtitle={targetLabel ?? `${targetType} · ${targetId.slice(0, 8)}`}
      width="md"
    >
      {error && (
        <div className="text-sm text-danger-700 px-1 py-2">
          Failed to load: {error}
        </div>
      )}
      {entries === null && !error && (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} className="h-12 rounded bg-surface-alt animate-pulse" />
          ))}
        </div>
      )}
      {entries !== null && entries.length === 0 && (
        <div className="text-sm text-ink-muted italic">
          No audit entries yet. Every status change, comment edit, or
          assignment will show up here.
        </div>
      )}
      {entries !== null && entries.length > 0 && (
        <ol className="relative space-y-3 pl-4 before:absolute before:left-1 before:top-1 before:bottom-1 before:w-px before:bg-border">
          {entries.map(e => (
            <li key={e.id} className="relative">
              {/* Timeline bullet */}
              <span
                aria-hidden="true"
                className="absolute -left-3 top-1 inline-block w-2 h-2 rounded-full bg-brand-500 ring-2 ring-surface"
              />
              <div className="text-xs text-ink-muted tabular-nums">
                {formatRelative(e.created_at)} · {e.user_id ?? 'system'}
              </div>
              <div className="text-sm text-ink font-medium">{describeAction(e)}</div>
              {(e.field || e.old_value || e.new_value) && (
                <div className="mt-0.5 text-xs text-ink-soft break-words">
                  {e.field && <span className="text-ink-muted mr-1">{e.field}:</span>}
                  {e.old_value && <span className="line-through text-ink-faint mr-1">{truncate(e.old_value, 80)}</span>}
                  {e.new_value && <span className="text-ink">{truncate(e.new_value, 120)}</span>}
                </div>
              )}
              <div className="mt-0.5 text-2xs text-ink-faint" title={e.created_at}>
                {formatAbsolute(e.created_at)}
              </div>
            </li>
          ))}
        </ol>
      )}
    </Drawer>
  );
}

function describeAction(e: AuditEntry): string {
  // Friendly labels for the most common actions. Falls back to the raw
  // verb (humanized) for anything else, so this stays useful even when
  // new audit actions are added without updating this map.
  const map: Record<string, string> = {
    tax_filing_update: 'Filing updated',
    tax_filing_delete: 'Filing deleted',
    tax_obligation_create: 'Obligation created',
    tax_filing_create: 'Filing created',
    stuck_followup_tasks_created: 'Auto-task created (stuck follow-up)',
    crm_invoice_create: 'Invoice created',
    crm_invoice_update: 'Invoice updated',
  };
  return map[e.action] ?? e.action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return iso;
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60_000);
  if (min < 1)  return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days < 7)  return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function formatAbsolute(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + '…';
}
