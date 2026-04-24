'use client';

// /tax-ops/tasks — list + Kanban toggle. State-of-art replacement
// for Diego's Notion "Tasks & Follow-ups" DB.

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  SearchIcon, LayoutListIcon, LayoutGridIcon, PlusIcon, FilterXIcon,
  CalendarIcon, MessagesSquareIcon, ListIcon,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { CrmErrorBox } from '@/components/crm/CrmErrorBox';
import { DateBadge } from '@/components/crm/DateBadge';
import { crmLoadShape } from '@/lib/useCrmFetch';
import { TaskBoard, type TaskRow } from '@/components/tax-ops/TaskBoard';
import { useToast } from '@/components/Toaster';

interface TaskFull extends TaskRow {
  description: string | null;
  parent_task_id: string | null;
  depends_on_task_id: string | null;
  tags: string[];
  related_filing_label: string | null;
}

const STATUSES = [
  { value: 'queued',              label: 'Queued' },
  { value: 'in_progress',         label: 'In progress' },
  { value: 'waiting_on_external', label: 'Waiting (external)' },
  { value: 'waiting_on_internal', label: 'Waiting (internal)' },
  { value: 'done',                label: 'Done' },
  { value: 'cancelled',           label: 'Cancelled' },
];

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'bg-danger-100 text-danger-800',
  high:   'bg-amber-100 text-amber-800',
  medium: 'bg-brand-100 text-brand-800',
  low:    'bg-surface-alt text-ink-soft',
};

const QUICK_FILTERS = [
  { key: 'mine',      label: 'Mine',      apply: (p: URLSearchParams) => p.set('assignee', 'Diego') },
  { key: 'overdue',   label: 'Overdue',   apply: (p: URLSearchParams) => { p.set('due_in_days', '0'); p.set('status', 'queued'); p.append('status', 'in_progress'); } },
  { key: 'waiting',   label: 'Waiting',   apply: (p: URLSearchParams) => { p.set('status', 'waiting_on_external'); p.append('status', 'waiting_on_internal'); } },
  { key: 'thisweek',  label: 'This week', apply: (p: URLSearchParams) => p.set('due_in_days', '7') },
];

type ViewMode = 'list' | 'board';

export default function TasksListPage() {
  const [view, setView] = useState<ViewMode>('list');
  const [rows, setRows] = useState<TaskFull[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<string>('');
  const [assignee, setAssignee] = useState<string>('');
  const [preset, setPreset] = useState<string>('');
  const toast = useToast();

  const load = useCallback(() => {
    const qs = new URLSearchParams();
    if (q) qs.set('q', q);
    if (status) qs.set('status', status);
    if (assignee) qs.set('assignee', assignee);
    if (preset) {
      const p = QUICK_FILTERS.find(f => f.key === preset);
      p?.apply(qs);
    }
    qs.set('only_root', '1');  // hide subtasks — they're shown on detail
    crmLoadShape<TaskFull[]>(`/api/tax-ops/tasks?${qs}`, b => (b as { tasks: TaskFull[] }).tasks)
      .then(rows => { setRows(rows); setError(null); })
      .catch(e => { setError(String(e instanceof Error ? e.message : e)); setRows([]); });
  }, [q, status, assignee, preset]);

  useEffect(() => { load(); }, [load]);

  const hasFilters = useMemo(() => q !== '' || status !== '' || assignee !== '' || preset !== '', [q, status, assignee, preset]);

  function clearFilters() { setQ(''); setStatus(''); setAssignee(''); setPreset(''); }

  async function moveTaskStatus(taskId: string, newStatus: string) {
    try {
      const res = await fetch(`/api/tax-ops/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success('Task moved');
      load();
    } catch (e) {
      toast.error(String(e instanceof Error ? e.message : e));
    }
  }

  if (rows === null) return <PageSkeleton />;

  return (
    <div>
      <PageHeader
        title="Tasks"
        subtitle="Subtasks, dependencies, recurring rules, comment thread. Press N to capture a new task from anywhere in /tax-ops."
        actions={
          <div className="flex items-center gap-1.5 rounded-md border border-border bg-surface p-0.5">
            <button
              onClick={() => setView('list')}
              className={`inline-flex items-center gap-1 px-2 py-1 text-[12px] rounded ${view === 'list' ? 'bg-surface-alt text-ink' : 'text-ink-muted hover:text-ink'}`}
            >
              <LayoutListIcon size={11} /> List
            </button>
            <button
              onClick={() => setView('board')}
              className={`inline-flex items-center gap-1 px-2 py-1 text-[12px] rounded ${view === 'board' ? 'bg-surface-alt text-ink' : 'text-ink-muted hover:text-ink'}`}
            >
              <LayoutGridIcon size={11} /> Board
            </button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative">
          <SearchIcon size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search title, description, tags…"
            className="pl-7 pr-2 py-1.5 text-[12.5px] border border-border rounded-md bg-surface w-[260px]"
          />
        </div>
        <select
          value={status}
          onChange={e => setStatus(e.target.value)}
          className="px-2 py-1.5 text-[12.5px] border border-border rounded-md bg-surface"
        >
          <option value="">All statuses</option>
          {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <input
          value={assignee}
          onChange={e => setAssignee(e.target.value)}
          placeholder="Assignee short name"
          className="px-2 py-1.5 text-[12.5px] border border-border rounded-md bg-surface w-[160px]"
        />
        <div className="flex gap-1 ml-2">
          {QUICK_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setPreset(preset === f.key ? '' : f.key)}
              className={`px-2 py-1 text-[11.5px] rounded-md border ${preset === f.key ? 'bg-brand-500 text-white border-brand-500' : 'border-border hover:bg-surface-alt'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="inline-flex items-center gap-1 px-2 py-1.5 text-[12px] text-ink-muted hover:text-ink border border-border rounded-md"
          >
            <FilterXIcon size={12} /> Clear
          </button>
        )}
        <div className="ml-auto">
          <button
            onClick={() => {
              // Dispatch synthetic 'N' keydown to open QuickCaptureModal
              window.dispatchEvent(new KeyboardEvent('keydown', { key: 'N' }));
            }}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-[12.5px] rounded-md bg-brand-500 hover:bg-brand-600 text-white"
          >
            <PlusIcon size={12} /> New <kbd className="text-[9px] px-1 py-0.5 rounded bg-brand-600">N</kbd>
          </button>
        </div>
      </div>

      {error && <CrmErrorBox message={error} onRetry={load} />}

      {rows.length === 0 ? (
        <EmptyState
          title="No tasks match these filters"
          description={hasFilters ? 'Loosen the filters or press N to add a new task.' : 'Press N anywhere in /tax-ops to capture your first task.'}
        />
      ) : view === 'list' ? (
        <div className="rounded-md border border-border bg-surface overflow-hidden">
          <table className="w-full text-[12.5px]">
            <thead className="bg-surface-alt text-ink-muted">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium">Title</th>
                <th className="px-3 py-2 font-medium">Priority</th>
                <th className="px-3 py-2 font-medium">Due</th>
                <th className="px-3 py-2 font-medium">Assignee</th>
                <th className="px-3 py-2 font-medium">Related</th>
                <th className="px-3 py-2 font-medium text-right">Sub / Comments</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(t => (
                <tr key={t.id} className="border-t border-border hover:bg-surface-alt/40">
                  <td className="px-3 py-2">
                    <Link href={`/tax-ops/tasks/${t.id}`} className="font-medium text-ink hover:text-brand-700">
                      {t.title}
                    </Link>
                    {t.tags.length > 0 && (
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {t.tags.filter(tg => !tg.startsWith('recurring_from:')).slice(0, 3).map((tg, i) => (
                          <span key={i} className="text-[10px] px-1 py-0 rounded bg-surface-alt text-ink-muted">{tg}</span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10.5px] font-medium ${PRIORITY_COLORS[t.priority] ?? ''}`}>
                      {t.priority}
                    </span>
                  </td>
                  <td className="px-3 py-2"><DateBadge value={t.due_date} mode="urgency" /></td>
                  <td className="px-3 py-2 text-ink-soft">{t.assignee ?? '—'}</td>
                  <td className="px-3 py-2 text-ink-soft">
                    {t.related_filing_label ?? t.related_entity_name ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-right text-ink-muted">
                    <span className="inline-flex items-center gap-2 text-[11px]">
                      {t.subtask_total > 0 && <><ListIcon size={10} /> {t.subtask_done}/{t.subtask_total}</>}
                      {t.comment_count > 0 && <><MessagesSquareIcon size={10} /> {t.comment_count}</>}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <TaskBoard tasks={rows} onMove={moveTaskStatus} />
      )}
    </div>
  );
}
