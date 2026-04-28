'use client';

import { useEffect, useState, useCallback } from 'react';
import { PlusIcon } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { CrmFormModal } from '@/components/crm/CrmFormModal';
import { ExportButton } from '@/components/crm/ExportButton';
import { CrmErrorBox } from '@/components/crm/CrmErrorBox';
import { crmLoadList } from '@/lib/useCrmFetch';
import { TASK_FIELDS } from '@/components/crm/schemas';
import { useToast } from '@/components/Toaster';
// Stint 63.J — port inline-edit primitives to tasks table.
import { InlineTextCell, InlineDateCell } from '@/components/tax-ops/inline-editors';
import { ChipSelect } from '@/components/tax-ops/ChipSelect';
import {
  LABELS_TASK_STATUS, LABELS_TASK_PRIORITY, TASK_STATUSES, TASK_PRIORITIES,
  type TaskStatus, type TaskPriority,
} from '@/lib/crm-types';

// Stint 63.J — chip tones for tasks status + priority.
const STATUS_TONES: Record<string, string> = {
  open:        'bg-info-50 text-info-800',
  in_progress: 'bg-amber-50 text-amber-800',
  done:        'bg-success-50 text-success-800',
  snoozed:     'bg-surface-alt text-ink-muted',
  cancelled:   'bg-surface-alt text-ink-faint',
};
const PRIORITY_TONES: Record<string, string> = {
  urgent: 'bg-danger-100 text-danger-800',
  high:   'bg-amber-100 text-amber-800',
  medium: 'bg-brand-100 text-brand-800',
  low:    'bg-surface-alt text-ink-soft',
};

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  reminder_at: string | null;
  related_type: string | null;
  related_id: string | null;
  auto_generated: boolean;
  completed_at: string | null;
  created_at: string;
}

export default function TasksPage() {
  const [rows, setRows] = useState<Task[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  const [priority, setPriority] = useState<string>('');
  const [newOpen, setNewOpen] = useState(false);
  const toast = useToast();

  const load = useCallback(() => {
    const qs = new URLSearchParams();
    if (status) qs.set('status', status);
    if (priority) qs.set('priority', priority);
    crmLoadList<Task>(`/api/crm/tasks?${qs}`)
      .then(rows => { setRows(rows); setError(null); })
      .catch((e: Error) => { setError(e.message || 'Network error'); setRows([]); });
  }, [status, priority]);
  useEffect(() => { load(); }, [load]);

  async function handleCreate(values: Record<string, unknown>) {
    const res = await fetch('/api/crm/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message ?? `Create failed (${res.status})`);
    }
    toast.success('Task created');
    await load();
  }

  async function toggleDone(id: string, current: string) {
    const nextStatus = current === 'done' ? 'open' : 'done';
    const res = await fetch(`/api/crm/tasks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    });
    if (res.ok) load();
  }

  // Stint 63.J — inline-edit helper for tasks. Mirror of the other CRM
  // patch helpers with optimistic update + rollback on error.
  async function patchTask(id: string, field: string, value: unknown): Promise<void> {
    try {
      const res = await fetch(`/api/crm/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message ?? `Save failed (${res.status})`);
      }
      setRows(prev => prev?.map(r =>
        r.id === id ? { ...r, [field]: value as never } : r
      ) ?? null);
    } catch (e) {
      toast.error(`Save failed: ${String(e instanceof Error ? e.message : e)}`);
      await load();
      throw e;
    }
  }

  if (rows === null) return <PageSkeleton />;

  const overdue = rows.filter(r => r.due_date && new Date(r.due_date) < new Date() && r.status !== 'done' && r.status !== 'cancelled').length;
  const dueToday = rows.filter(r => r.due_date === new Date().toISOString().slice(0, 10)).length;

  return (
    <div>
      <PageHeader
        title="Tasks"
        subtitle={`${rows.length} open${overdue ? ` · ${overdue} overdue` : ''}${dueToday ? ` · ${dueToday} due today` : ''}. Press N anywhere to quick-create.`}
        actions={
          <Button onClick={() => setNewOpen(true)} variant="primary" size="sm" icon={<PlusIcon size={13} />}>
            New task
          </Button>
        }
      />
      <CrmFormModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        mode="create"
        title="New task"
        subtitle="Follow-up, reminder, or work item."
        fields={TASK_FIELDS}
        initial={{ priority: 'medium', status: 'open' }}
        onSave={handleCreate}
      />
      {error && <div className="mb-3"><CrmErrorBox message={error} onRetry={load} /></div>}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <select value={status} onChange={e => setStatus(e.target.value)}
          className="px-2 py-1.5 text-sm border border-border rounded-md bg-white">
          <option value="">Open + In progress + Snoozed</option>
          {TASK_STATUSES.map(s => <option key={s} value={s}>{LABELS_TASK_STATUS[s]}</option>)}
        </select>
        <select value={priority} onChange={e => setPriority(e.target.value)}
          className="px-2 py-1.5 text-sm border border-border rounded-md bg-white">
          <option value="">All priorities</option>
          {TASK_PRIORITIES.map(p => <option key={p} value={p}>{LABELS_TASK_PRIORITY[p]}</option>)}
        </select>
        <div className="ml-auto">
          <ExportButton entity="tasks" />
        </div>
      </div>

      {rows.length === 0 ? (
        (() => {
          const filtersActive = status !== '' || priority !== '';
          return (
            <EmptyState
              illustration="inbox"
              title={filtersActive ? 'No tasks match these filters' : 'No tasks yet'}
              description={filtersActive
                ? 'Loosen your filters or clear them to see all tasks.'
                : 'Create a task to track a follow-up. cifra also auto-generates tasks when a Key Account has a stale declaration. Press N anywhere in /crm for quick-capture.'}
              action={filtersActive ? undefined : (
                <Button onClick={() => setNewOpen(true)} variant="primary" size="sm" icon={<PlusIcon size={13} />}>
                  New task
                </Button>
              )}
            />
          );
        })()
      ) : (
        <div className="border border-border rounded-lg overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead className="bg-surface-alt text-ink-muted">
              <tr>
                <th className="text-left px-3 py-2 font-medium w-8"></th>
                <th className="text-left px-3 py-2 font-medium">Priority</th>
                <th className="text-left px-3 py-2 font-medium">Title</th>
                <th className="text-left px-3 py-2 font-medium">Status</th>
                <th className="text-left px-3 py-2 font-medium">Due</th>
                <th className="text-left px-3 py-2 font-medium">Related</th>
                <th className="text-left px-3 py-2 font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const isDone = r.status === 'done';
                return (
                  <tr key={r.id} className={`border-t border-border hover:bg-surface-alt/50 ${isDone ? 'opacity-60' : ''}`}>
                    {/* Done checkbox — kept as native checkbox for tactile
                        feedback. Toggles status open ↔ done. */}
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={isDone}
                        onChange={() => toggleDone(r.id, r.status)}
                        className="h-4 w-4 accent-brand-500 cursor-pointer"
                        title={isDone ? 'Mark as open' : 'Mark as done'}
                      />
                    </td>
                    {/* Priority — ChipSelect with priority tones. */}
                    <td className="px-3 py-2">
                      <ChipSelect
                        value={r.priority}
                        options={TASK_PRIORITIES.map(v => ({
                          value: v,
                          label: LABELS_TASK_PRIORITY[v as TaskPriority],
                          tone: PRIORITY_TONES[v],
                        }))}
                        onChange={next => { void patchTask(r.id, 'priority', next); }}
                        ariaLabel="Priority"
                      />
                    </td>
                    {/* Title — InlineTextCell. line-through when done. */}
                    <td className={`px-3 py-2 ${isDone ? 'line-through' : ''} max-w-[320px]`}>
                      <InlineTextCell
                        value={r.title}
                        onSave={async v => { await patchTask(r.id, 'title', v); }}
                        placeholder="Untitled task"
                      />
                    </td>
                    {/* Status — ChipSelect (open / in_progress / done /
                        snoozed / cancelled). */}
                    <td className="px-3 py-2">
                      <ChipSelect
                        value={r.status}
                        options={TASK_STATUSES.map(v => ({
                          value: v,
                          label: LABELS_TASK_STATUS[v as TaskStatus],
                          tone: STATUS_TONES[v],
                        }))}
                        onChange={next => { void patchTask(r.id, 'status', next); }}
                        ariaLabel="Status"
                      />
                    </td>
                    {/* Due — InlineDateCell. urgency mode highlights
                        overdue / today (kept like the previous read-only
                        styling but now editable). */}
                    <td className="px-3 py-2">
                      <InlineDateCell
                        value={r.due_date}
                        onSave={async v => { await patchTask(r.id, 'due_date', v); }}
                      />
                    </td>
                    {/* Related — read-only (changing the parent of a task
                        is rare + heavy; happens in detail or via N). */}
                    <td className="px-3 py-2 text-ink-muted">{r.related_type ?? '—'}</td>
                    {/* Source — read-only (server-derived). */}
                    <td className="px-3 py-2 text-ink-muted">{r.auto_generated ? 'cifra auto' : 'manual'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
