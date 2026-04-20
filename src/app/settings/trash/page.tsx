'use client';

// ════════════════════════════════════════════════════════════════════════
// /settings/trash — browsable soft-delete archive with restore.
//
// Stint 13 / Fase 1 item #4 per Diego's "Veeva-level deletion" brief.
// Matches the Recycle Bin pattern every enterprise SaaS uses: soft-
// archived records stay here indefinitely (today; auto-purge is Fase 2)
// and can be restored with a single click.
// ════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Trash2Icon, RotateCcwIcon, Building2Icon, ArchiveIcon,
} from 'lucide-react';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/Toaster';
import { describeApiError } from '@/lib/ui-errors';

interface TrashClient {
  id: string;
  name: string;
  kind: string;
  archived_at: string;
  entity_count: number;
}

interface TrashEntity {
  id: string;
  name: string;
  client_id: string | null;
  client_name: string | null;
  deleted_at: string;
  deleted_reason: string | null;
  declaration_count: number;
}

export default function TrashPage() {
  const toast = useToast();
  const [clients, setClients] = useState<TrashClient[] | null>(null);
  const [entities, setEntities] = useState<TrashEntity[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/trash');
      const body = await res.json();
      if (!res.ok) {
        toast.error(body?.error?.message ?? 'Could not load the trash.');
        return;
      }
      setClients(body.clients ?? []);
      setEntities(body.entities ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Network error.');
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  async function restoreClient(c: TrashClient) {
    setBusyId(c.id);
    try {
      const res = await fetch(`/api/clients/${c.id}/restore`, { method: 'POST' });
      if (!res.ok) {
        const e = await describeApiError(res, 'Could not restore.');
        toast.error(e.message, e.hint);
        return;
      }
      toast.success(`${c.name} restored.`);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function restoreEntity(e: TrashEntity) {
    setBusyId(e.id);
    try {
      const res = await fetch(`/api/entities/${e.id}/restore`, { method: 'POST' });
      if (!res.ok) {
        const err = await describeApiError(res, 'Could not restore.');
        toast.error(err.message, err.hint);
        return;
      }
      toast.success(`${e.name} restored.`);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  if (clients === null || entities === null) return <PageSkeleton />;

  const isEmpty = clients.length === 0 && entities.length === 0;

  return (
    <div className="max-w-5xl">
      <div className="mb-5">
        <div className="text-[11px] text-ink-faint mb-1">
          <Link href="/settings" className="hover:underline">Settings</Link> ›
        </div>
        <h1 className="text-[22px] font-semibold tracking-tight inline-flex items-center gap-2">
          <ArchiveIcon size={18} className="text-brand-500" />
          Trash
        </h1>
        <p className="text-[12.5px] text-ink-muted mt-1 max-w-xl">
          Soft-archived clients and entities. They&apos;re hidden from the
          workspace but the data is fully intact — restore any time.
        </p>
      </div>

      {/* Retention notice */}
      <div className="mb-6 rounded-md border border-border bg-surface-alt/40 px-4 py-3 text-[12px] text-ink-soft leading-relaxed">
        <strong>Retention note.</strong> Today archived items stay here
        indefinitely. A future 90-day auto-purge is on the roadmap
        (Fase 2) — items archived <em>more than 90 days ago</em> will
        be flagged then for permanent deletion with review. Filed and
        paid declarations are retained per Art. 70 LTVA (10 years)
        and will not auto-purge.
      </div>

      {isEmpty ? (
        <div className="bg-surface border border-border rounded-lg">
          <EmptyState
            illustration="empty_approved"
            title="Trash is empty"
            description="Nothing has been archived. When you archive a client or entity from its detail page, it lands here — recoverable with one click."
          />
        </div>
      ) : (
        <div className="space-y-6">
          {clients.length > 0 && (
            <section className="bg-surface border border-border rounded-lg overflow-hidden">
              <header className="px-4 py-3 border-b border-divider flex items-center gap-2">
                <Building2Icon size={13} className="text-ink-muted" />
                <h3 className="text-[13px] font-semibold text-ink">
                  Archived clients <span className="text-ink-muted font-normal">· {clients.length}</span>
                </h3>
              </header>
              <ul className="divide-y divide-divider">
                {clients.map(c => (
                  <li key={c.id} className="px-4 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-ink">{c.name}</div>
                      <div className="text-[11px] text-ink-muted mt-0.5">
                        Archived {formatRelative(c.archived_at)} · kind: {c.kind}
                        {c.entity_count > 0 && ` · ${c.entity_count} entit${c.entity_count === 1 ? 'y' : 'ies'} still active under this client`}
                      </div>
                    </div>
                    <button
                      onClick={() => restoreClient(c)}
                      disabled={busyId === c.id}
                      className="h-8 px-3 rounded-md border border-border-strong text-[12px] font-medium text-ink-soft hover:text-ink hover:bg-surface-alt disabled:opacity-50 inline-flex items-center gap-1.5"
                    >
                      <RotateCcwIcon size={12} /> Restore
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {entities.length > 0 && (
            <section className="bg-surface border border-border rounded-lg overflow-hidden">
              <header className="px-4 py-3 border-b border-divider flex items-center gap-2">
                <Trash2Icon size={13} className="text-ink-muted" />
                <h3 className="text-[13px] font-semibold text-ink">
                  Archived entities <span className="text-ink-muted font-normal">· {entities.length}</span>
                </h3>
              </header>
              <ul className="divide-y divide-divider">
                {entities.map(e => (
                  <li key={e.id} className="px-4 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-ink">{e.name}</div>
                      <div className="text-[11px] text-ink-muted mt-0.5">
                        Archived {formatRelative(e.deleted_at)}
                        {e.client_name && <> · client: {e.client_name}</>}
                        {e.declaration_count > 0 && ` · ${e.declaration_count} declaration${e.declaration_count === 1 ? '' : 's'} still under this entity`}
                        {e.deleted_reason && e.deleted_reason !== 'user_deleted' && ` · reason: ${e.deleted_reason}`}
                      </div>
                    </div>
                    <button
                      onClick={() => restoreEntity(e)}
                      disabled={busyId === e.id}
                      className="h-8 px-3 rounded-md border border-border-strong text-[12px] font-medium text-ink-soft hover:text-ink hover:bg-surface-alt disabled:opacity-50 inline-flex items-center gap-1.5"
                    >
                      <RotateCcwIcon size={12} /> Restore
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const secs = Math.round((Date.now() - then) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.round(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.round(secs / 3600)}h ago`;
  return `${Math.round(secs / 86400)}d ago`;
}
