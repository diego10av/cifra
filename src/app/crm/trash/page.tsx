'use client';

import { useEffect, useState, useCallback } from 'react';
import { Trash2Icon, RotateCcwIcon } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/Toaster';

interface TrashItem {
  kind: 'company' | 'contact' | 'opportunity' | 'matter';
  id: string;
  label: string;
  deleted_at: string;
}

const KIND_LABELS: Record<TrashItem['kind'], string> = {
  company:     '🏢 Company',
  contact:     '👤 Contact',
  opportunity: '🎯 Opportunity',
  matter:      '⚖️ Matter',
};

export default function TrashPage() {
  const [rows, setRows] = useState<TrashItem[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const toast = useToast();

  const load = useCallback(() => {
    fetch('/api/crm/trash', { cache: 'no-store' })
      .then(r => r.json())
      .then(setRows)
      .catch(() => setRows([]));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleRestore(kind: string, id: string, label: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/crm/trash/${kind}/${id}`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err?.error?.message ?? `Restore failed`);
        return;
      }
      toast.success(`Restored "${label}"`);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function handlePermanentDelete(kind: string, id: string, label: string) {
    if (!confirm(
      `Permanently delete "${label}"?\n\n` +
      `This is irreversible. The record + all its audit history survives in audit_log, but the record itself is gone.\n\n` +
      `Are you sure?`,
    )) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/crm/trash/${kind}/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err?.error?.message ?? `Delete failed`);
        return;
      }
      toast.success(`Permanently deleted "${label}"`);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  if (rows === null) return <PageSkeleton />;

  // Group by kind.
  const byKind: Record<string, TrashItem[]> = {};
  for (const r of rows) {
    if (!byKind[r.kind]) byKind[r.kind] = [];
    byKind[r.kind].push(r);
  }

  return (
    <div>
      <PageHeader
        title="Trash"
        subtitle={`${rows.length} deleted record${rows.length === 1 ? '' : 's'} · Records auto-purge after 30 days`}
      />

      {rows.length === 0 ? (
        <EmptyState illustration="folder" title="Trash is empty" description="Deleted CRM records appear here for 30 days before being permanently purged." />
      ) : (
        <div className="space-y-4">
          {(['matter', 'company', 'contact', 'opportunity'] as const).map(kind => {
            const items = byKind[kind] ?? [];
            if (items.length === 0) return null;
            return (
              <div key={kind}>
                <h3 className="text-[12px] uppercase tracking-wide font-semibold text-ink-muted mb-2">
                  {KIND_LABELS[kind]} ({items.length})
                </h3>
                <div className="border border-border rounded-lg overflow-hidden bg-white">
                  <table className="w-full text-[12.5px]">
                    <thead className="bg-surface-alt text-ink-muted">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Name</th>
                        <th className="text-left px-3 py-2 font-medium">Deleted</th>
                        <th className="text-right px-3 py-2 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map(r => {
                        const deletedDate = new Date(r.deleted_at);
                        const purgeDate = new Date(deletedDate);
                        purgeDate.setDate(purgeDate.getDate() + 30);
                        const daysLeft = Math.max(0, Math.ceil((purgeDate.getTime() - Date.now()) / 86400000));
                        return (
                          <tr key={r.id} className="border-t border-border">
                            <td className="px-3 py-2">{r.label}</td>
                            <td className="px-3 py-2 text-ink-muted tabular-nums">
                              {deletedDate.toISOString().slice(0, 10)}
                              <span className={`ml-2 text-[10.5px] ${daysLeft < 7 ? 'text-danger-700' : 'text-ink-faint'}`}>
                                · purge in {daysLeft}d
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right">
                              <Button
                                variant="secondary"
                                size="sm"
                                icon={<RotateCcwIcon size={12} />}
                                onClick={() => handleRestore(r.kind, r.id, r.label)}
                                loading={busyId === r.id}
                              >
                                Restore
                              </Button>
                              <button
                                onClick={() => handlePermanentDelete(r.kind, r.id, r.label)}
                                disabled={busyId === r.id}
                                className="ml-2 h-7 px-2.5 rounded-md border border-danger-300 text-[11px] text-danger-700 hover:bg-danger-50 inline-flex items-center gap-1 disabled:opacity-40"
                              >
                                <Trash2Icon size={11} /> Delete permanently
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
