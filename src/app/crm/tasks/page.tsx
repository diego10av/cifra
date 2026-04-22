'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  LABELS_TASK_STATUS, LABELS_TASK_PRIORITY, TASK_STATUSES, TASK_PRIORITIES,
  formatDate, type TaskStatus, type TaskPriority,
} from '@/lib/crm-types';

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
  const [status, setStatus] = useState<string>('');
  const [priority, setPriority] = useState<string>('');

  const load = () => {
    const qs = new URLSearchParams();
    if (status) qs.set('status', status);
    if (priority) qs.set('priority', priority);
    fetch(`/api/crm/tasks?${qs}`, { cache: 'no-store' })
      .then(r => r.json()).then(setRows).catch(() => setRows([]));
  };
  useEffect(() => { load(); }, [status, priority]);

  if (rows === null) return <PageSkeleton />;

  const overdue = rows.filter(r => r.due_date && new Date(r.due_date) < new Date() && r.status !== 'done' && r.status !== 'cancelled').length;
  const dueToday = rows.filter(r => r.due_date === new Date().toISOString().slice(0, 10)).length;

  return (
    <div>
      <PageHeader title="Tasks" subtitle={`${rows.length} open${overdue ? ` · ${overdue} overdue` : ''}${dueToday ? ` · ${dueToday} due today` : ''}`} />
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <select value={status} onChange={e => setStatus(e.target.value)}
          className="px-2 py-1.5 text-[12.5px] border border-border rounded-md bg-white">
          <option value="">Open + In progress + Snoozed</option>
          {TASK_STATUSES.map(s => <option key={s} value={s}>{LABELS_TASK_STATUS[s]}</option>)}
        </select>
        <select value={priority} onChange={e => setPriority(e.target.value)}
          className="px-2 py-1.5 text-[12.5px] border border-border rounded-md bg-white">
          <option value="">All priorities</option>
          {TASK_PRIORITIES.map(p => <option key={p} value={p}>{LABELS_TASK_PRIORITY[p]}</option>)}
        </select>
      </div>

      {rows.length === 0 ? (
        <EmptyState illustration="inbox" title="No tasks" description="Create a task to track a follow-up, or let cifra auto-generate them when a Key Account has a stale declaration." />
      ) : (
        <div className="border border-border rounded-lg overflow-hidden bg-white">
          <table className="w-full text-[12.5px]">
            <thead className="bg-surface-alt text-ink-muted">
              <tr>
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
                const isOverdue = r.due_date && new Date(r.due_date) < new Date() && r.status !== 'done' && r.status !== 'cancelled';
                return (
                  <tr key={r.id} className="border-t border-border hover:bg-surface-alt/50">
                    <td className="px-3 py-2">{LABELS_TASK_PRIORITY[r.priority as TaskPriority] ?? r.priority}</td>
                    <td className="px-3 py-2 font-medium">{r.title}</td>
                    <td className="px-3 py-2">{LABELS_TASK_STATUS[r.status as TaskStatus] ?? r.status}</td>
                    <td className={`px-3 py-2 tabular-nums ${isOverdue ? 'text-danger-700 font-medium' : 'text-ink-muted'}`}>{formatDate(r.due_date)}</td>
                    <td className="px-3 py-2 text-ink-muted">{r.related_type ?? '—'}</td>
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
