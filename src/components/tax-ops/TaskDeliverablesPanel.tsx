'use client';

// TaskDeliverablesPanel — stint 84.C → 84.D
//
// Inline manager for a task's deliverables list (the docs that need to
// exist as part of completing the task). Status is manual only —
// cifra is not the document store, so adding a link or attachment
// never auto-bumps. Diego: "para eso ya tenemos iManage".
//
// 84.D: data lives in its own table tax_ops_task_deliverables. Each
// row is independent — no full-array replace, no concurrent-edit
// stomping. Per-item PATCH/DELETE for granular audit trail.

import { useState } from 'react';
import {
  PlusIcon, Link2Icon, Trash2Icon, ExternalLinkIcon, XIcon, CheckIcon,
} from 'lucide-react';

export type DeliverableStatus =
  | 'pending' | 'drafted' | 'reviewed' | 'signed' | 'filed' | 'na';

export interface Deliverable {
  id: string;
  label: string;
  status: DeliverableStatus;
  due_date: string | null;
  link_url: string | null;
  notes: string | null;
  sort_order: number;
}

const STATUS_OPTIONS: Array<{ value: DeliverableStatus; label: string; tone: string }> = [
  { value: 'pending',  label: 'Pending',  tone: 'bg-surface-alt text-ink-soft border-border' },
  { value: 'drafted',  label: 'Drafted',  tone: 'bg-info-50 text-info-800 border-info-200' },
  { value: 'reviewed', label: 'Reviewed', tone: 'bg-amber-50 text-amber-800 border-amber-200' },
  { value: 'signed',   label: 'Signed',   tone: 'bg-warning-50 text-warning-800 border-warning-200' },
  { value: 'filed',    label: 'Filed',    tone: 'bg-success-50 text-success-800 border-success-200' },
  { value: 'na',       label: 'N/A',      tone: 'bg-surface-alt text-ink-faint border-border' },
];

export function TaskDeliverablesPanel({
  taskId, deliverables, onSaved, dense = false,
}: {
  taskId: string;
  deliverables: Deliverable[];
  /** Called after a successful create/update/delete so the parent refetches. */
  onSaved: () => void;
  /** Compact layout (used inside SubtaskNode expanded panel). */
  dense?: boolean;
}) {
  const [draftLabel, setDraftLabel] = useState('');
  const [linkEditing, setLinkEditing] = useState<{ id: string; value: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function add(label: string) {
    const trimmed = label.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      await fetch(`/api/tax-ops/tasks/${taskId}/deliverables`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: trimmed }),
      });
      setDraftLabel('');
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  async function update(id: string, patch: Partial<Deliverable>) {
    setBusy(true);
    try {
      await fetch(`/api/tax-ops/deliverables/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      await fetch(`/api/tax-ops/deliverables/${id}`, { method: 'DELETE' });
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  const containerClass = dense
    ? 'space-y-1.5'
    : 'rounded-md border border-border bg-surface px-4 py-3 space-y-2';

  return (
    <div className={containerClass}>
      {!dense && (
        <h3 className="text-sm font-semibold text-ink mb-1">
          Deliverables{' '}
          <span className="text-xs font-normal text-ink-muted">
            ({deliverables.length})
          </span>
        </h3>
      )}
      {dense && (
        <span className="text-2xs uppercase tracking-wide font-semibold text-ink-muted">
          Deliverables
        </span>
      )}

      {deliverables.length === 0 && (
        <p className="text-2xs text-ink-faint italic">
          No deliverables tracked. Add one to break a workstream into the actual
          documents — no need to upload them here, a link to iManage is enough.
        </p>
      )}

      {deliverables.map(d => (
        <div
          key={d.id}
          className="group/del flex items-center gap-1.5 text-sm border-b border-border/30 last:border-b-0 pb-1.5 last:pb-0"
        >
          <StatusChip
            value={d.status}
            onChange={(next) => void update(d.id, { status: next })}
          />
          <input
            defaultValue={d.label}
            key={`${d.id}-${d.label}`}
            onBlur={async (e) => {
              const v = e.target.value.trim();
              if (v && v !== d.label) await update(d.id, { label: v });
            }}
            className="flex-1 px-1.5 py-0.5 text-sm bg-transparent border border-transparent rounded focus:border-border focus:bg-surface"
          />
          <input
            type="date"
            value={d.due_date ?? ''}
            onChange={e => void update(d.id, { due_date: e.target.value || null })}
            className="px-1 py-0.5 text-2xs border border-border rounded bg-surface tabular-nums w-[110px]"
          />
          {linkEditing?.id === d.id ? (
            <span className="inline-flex items-center gap-1">
              <input
                autoFocus
                value={linkEditing.value}
                onChange={e => setLinkEditing({ id: d.id, value: e.target.value })}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void update(d.id, { link_url: linkEditing.value.trim() || null });
                    setLinkEditing(null);
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    setLinkEditing(null);
                  }
                }}
                placeholder="https://imanage… / Drive / Dropbox URL"
                className="px-1.5 py-0.5 text-2xs border border-border rounded bg-surface w-[200px]"
              />
              <button
                type="button"
                onClick={() => {
                  void update(d.id, { link_url: linkEditing.value.trim() || null });
                  setLinkEditing(null);
                }}
                className="p-0.5 text-ink-muted hover:text-success-700"
                aria-label="Save link"
              >
                <CheckIcon size={11} />
              </button>
              <button
                type="button"
                onClick={() => setLinkEditing(null)}
                className="p-0.5 text-ink-muted hover:text-danger-600"
                aria-label="Cancel"
              >
                <XIcon size={11} />
              </button>
            </span>
          ) : d.link_url ? (
            <a
              href={d.link_url}
              target="_blank"
              rel="noopener noreferrer"
              title={d.link_url}
              className="inline-flex items-center gap-0.5 px-1 py-0.5 text-2xs text-info-700 hover:text-info-800 rounded hover:bg-info-50"
            >
              <ExternalLinkIcon size={10} />
              <span className="max-w-[120px] truncate">link</span>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setLinkEditing({ id: d.id, value: d.link_url ?? '' });
                }}
                aria-label="Edit link"
                className="ml-0.5 text-ink-muted hover:text-ink"
              >
                ✎
              </button>
            </a>
          ) : (
            <button
              type="button"
              onClick={() => setLinkEditing({ id: d.id, value: '' })}
              aria-label="Add link"
              title="Attach an iManage / Drive URL (optional)"
              className="p-0.5 text-ink-muted hover:text-info-700 opacity-0 group-hover/del:opacity-100"
            >
              <Link2Icon size={11} />
            </button>
          )}
          <button
            type="button"
            onClick={() => void remove(d.id)}
            disabled={busy}
            aria-label="Remove deliverable"
            className="p-0.5 text-ink-muted hover:text-danger-600 opacity-0 group-hover/del:opacity-100"
          >
            <Trash2Icon size={11} />
          </button>
        </div>
      ))}

      <div className="flex items-center gap-1.5 pt-1">
        <input
          value={draftLabel}
          onChange={e => setDraftLabel(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void add(draftLabel);
            }
          }}
          placeholder='+ Add deliverable (e.g. "SPA v1", "Loan Assignment Agreement")'
          className="flex-1 px-2 py-1 text-xs border border-border rounded bg-surface"
        />
        <button
          type="button"
          onClick={() => void add(draftLabel)}
          disabled={!draftLabel.trim() || busy}
          className="inline-flex items-center gap-1 px-2 py-1 text-2xs rounded bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50"
        >
          <PlusIcon size={11} /> Add
        </button>
      </div>
    </div>
  );
}

function StatusChip({
  value, onChange,
}: {
  value: DeliverableStatus;
  onChange: (next: DeliverableStatus) => void;
}) {
  const meta = STATUS_OPTIONS.find(o => o.value === value) ?? STATUS_OPTIONS[0];
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value as DeliverableStatus)}
      title={`Status: ${meta.label}`}
      className={`text-2xs px-1.5 py-0.5 rounded border font-medium uppercase tracking-wide cursor-pointer ${meta.tone}`}
    >
      {STATUS_OPTIONS.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

/** Roll-up summary chip used on collapsed rows ("📄 2/4 drafted"). */
export function DeliverablesRollupChip({ items }: { items: Deliverable[] }) {
  if (!Array.isArray(items) || items.length === 0) return null;
  const drafted = items.filter(d => d.status !== 'pending' && d.status !== 'na').length;
  const filed   = items.filter(d => d.status === 'filed').length;
  const allDone = filed === items.length;
  const tone = allDone
    ? 'bg-success-50 text-success-800 border-success-200'
    : drafted > 0
      ? 'bg-info-50 text-info-700 border-info-200'
      : 'bg-surface-alt text-ink-soft border-border';
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-2xs px-1.5 py-0.5 rounded border font-medium ${tone}`}
      title={items.map(d => `${d.label} — ${d.status}`).join('\n')}
    >
      📄 {drafted}/{items.length}
    </span>
  );
}
