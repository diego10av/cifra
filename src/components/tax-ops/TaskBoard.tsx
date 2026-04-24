'use client';

// Kanban board — 4 columns (queued · in progress · waiting · done).
// "waiting_on_external" + "waiting_on_internal" collapse into Waiting
// for visual scan; the actual status is shown on the card chip.
// Cancelled is hidden by default (filter toggle would live on the
// parent page — this component just renders what it's given).
//
// Drag-drop uses HTML5 native (no external lib). On drop, we PATCH
// the new status and let the parent re-fetch.

import { useState } from 'react';
import Link from 'next/link';
import { CalendarIcon, MessagesSquareIcon, ListIcon } from 'lucide-react';

export type TaskRow = {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  assignee: string | null;
  subtask_total: number;
  subtask_done: number;
  comment_count: number;
  related_entity_name: string | null;
};

const COLUMNS: { key: string; label: string; statuses: string[] }[] = [
  { key: 'queued',      label: 'Queued',      statuses: ['queued'] },
  { key: 'in_progress', label: 'In progress', statuses: ['in_progress'] },
  { key: 'waiting',     label: 'Waiting',     statuses: ['waiting_on_external', 'waiting_on_internal'] },
  { key: 'done',        label: 'Done',        statuses: ['done'] },
];

const PRIORITY_TONE: Record<string, string> = {
  urgent: 'border-l-danger-500',
  high:   'border-l-amber-500',
  medium: 'border-l-brand-400',
  low:    'border-l-border-strong',
};

export function TaskBoard({
  tasks, onMove,
}: {
  tasks: TaskRow[];
  onMove: (taskId: string, newStatus: string) => Promise<void>;
}) {
  const [dragId, setDragId] = useState<string | null>(null);

  function tasksFor(col: typeof COLUMNS[0]): TaskRow[] {
    return tasks.filter(t => col.statuses.includes(t.status));
  }

  async function handleDrop(columnKey: string) {
    if (!dragId) return;
    const col = COLUMNS.find(c => c.key === columnKey);
    if (!col) return;
    const targetStatus = col.statuses[0]!;  // waiting drops land on _external
    await onMove(dragId, targetStatus);
    setDragId(null);
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
      {COLUMNS.map(col => (
        <div
          key={col.key}
          onDragOver={e => e.preventDefault()}
          onDrop={() => handleDrop(col.key)}
          className="rounded-md border border-border bg-surface-alt/30 min-h-[200px]"
        >
          <div className="px-3 py-2 border-b border-border bg-surface-alt text-[12px] font-semibold text-ink-soft">
            {col.label}
            <span className="ml-1.5 font-normal text-ink-muted tabular-nums">
              ({tasksFor(col).length})
            </span>
          </div>
          <div className="p-2 space-y-1.5">
            {tasksFor(col).map(t => (
              <Link
                key={t.id}
                href={`/tax-ops/tasks/${t.id}`}
                draggable
                onDragStart={() => setDragId(t.id)}
                className={`block rounded-md border-l-[3px] ${PRIORITY_TONE[t.priority] ?? 'border-l-border-strong'} border border-border bg-surface p-2 hover:shadow-sm transition-shadow cursor-grab`}
              >
                <div className="text-[12.5px] font-medium text-ink line-clamp-2">{t.title}</div>
                {t.related_entity_name && (
                  <div className="text-[10.5px] text-ink-muted mt-0.5 truncate">{t.related_entity_name}</div>
                )}
                <div className="flex items-center gap-2 mt-1 text-[10.5px] text-ink-muted">
                  {t.due_date && (
                    <span className="inline-flex items-center gap-0.5">
                      <CalendarIcon size={9} /> {new Date(t.due_date).toLocaleDateString()}
                    </span>
                  )}
                  {t.subtask_total > 0 && (
                    <span className="inline-flex items-center gap-0.5">
                      <ListIcon size={9} /> {t.subtask_done}/{t.subtask_total}
                    </span>
                  )}
                  {t.comment_count > 0 && (
                    <span className="inline-flex items-center gap-0.5">
                      <MessagesSquareIcon size={9} /> {t.comment_count}
                    </span>
                  )}
                  {t.assignee && (
                    <span className="ml-auto px-1 bg-surface-alt text-ink-soft rounded">{t.assignee}</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
