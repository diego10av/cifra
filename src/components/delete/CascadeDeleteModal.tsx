'use client';

// ════════════════════════════════════════════════════════════════════════
// CascadeDeleteModal — destructive delete with blast-radius preview
// and typed-name confirmation.
//
// Supports three scopes:
//   - client: offers "Archive" (safe, requires zero entities) OR
//             "Delete permanently" (cascade, typed-name required)
//   - entity: same two paths
//   - declaration: "Delete" with preview; force-flag surfaces when
//                  status is approved/filed/paid
//
// Emits onDone after successful deletion — caller routes away.
// ════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/Toaster';
import { describeApiError, formatUiError } from '@/lib/ui-errors';
import { AlertTriangleIcon, Trash2Icon, ArchiveIcon, Loader2Icon } from 'lucide-react';

export type CascadeScope = 'client' | 'entity' | 'declaration';

interface Preview {
  name: string;
  summary: string[];
  counts: Record<string, number | undefined>;
}

export function CascadeDeleteModal({
  open, onClose, onDone,
  scope, targetId, targetName,
  status,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  scope: CascadeScope;
  targetId: string;
  /** The server-side "ground truth" name for the confirm-typed field. */
  targetName: string;
  /** Only relevant for scope === 'declaration'. */
  status?: string;
}) {
  const toast = useToast();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || scope === 'declaration') { setPreview(null); return; }
    let cancelled = false;
    (async () => {
      setLoadingPreview(true);
      try {
        const res = await fetch(`/api/${scope === 'client' ? 'clients' : 'entities'}/${targetId}/preview-delete`);
        const body = await res.json();
        if (!cancelled && res.ok) {
          setPreview({
            name: body.preview?.name ?? targetName,
            summary: body.summary ?? [],
            counts: body.preview?.counts ?? {},
          });
        }
      } catch { /* fall through */ }
      if (!cancelled) setLoadingPreview(false);
    })();
    return () => { cancelled = true; };
  }, [open, scope, targetId, targetName]);

  useEffect(() => {
    if (!open) { setTyped(''); }
  }, [open]);

  async function archiveOnly() {
    if (scope !== 'client' && scope !== 'entity') return;
    setBusy(true);
    try {
      const res = await fetch(`/api/${scope === 'client' ? 'clients' : 'entities'}/${targetId}`, {
        method: 'DELETE',
        ...(scope === 'entity' ? {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: 'user_archived_from_modal' }),
        } : {}),
      });
      if (!res.ok) {
        const e = await describeApiError(res, 'Could not archive.');
        toast.error(e.message, e.hint);
        return;
      }
      toast.success(`${targetName} archived.`);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Network error.');
    } finally {
      setBusy(false);
    }
  }

  async function cascadeDelete() {
    setBusy(true);
    try {
      let url: string;
      if (scope === 'declaration') {
        const isLocked = status === 'approved' || status === 'filed' || status === 'paid';
        url = `/api/declarations/${targetId}${isLocked ? '?force=true' : ''}`;
      } else {
        url = `/api/${scope === 'client' ? 'clients' : 'entities'}/${targetId}?cascade=true&confirm=${encodeURIComponent(targetName)}`;
      }
      const res = await fetch(url, { method: 'DELETE' });
      if (!res.ok) {
        const e = await describeApiError(res, 'Could not delete.');
        toast.error(e.message, e.hint);
        return;
      }
      toast.success(`${targetName} permanently deleted.`);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Network error.');
    } finally {
      setBusy(false);
    }
  }

  const typedMatches = typed.trim() === targetName;
  const isDeclaration = scope === 'declaration';
  const scopeLabel = scope === 'client' ? 'client' : scope === 'entity' ? 'entity' : 'declaration';
  const locked = status && (status === 'approved' || status === 'filed' || status === 'paid');

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={
        <span className="inline-flex items-center gap-2">
          <AlertTriangleIcon size={16} className="text-danger-500" />
          Delete this {scopeLabel}
        </span>
      }
      subtitle={`"${targetName}" — choose how destructively.`}
      dismissable={!busy}
    >
      <div className="space-y-5">
        {/* Preview of what will be cascaded */}
        {!isDeclaration && (
          <div className="rounded-md border border-border bg-surface-alt/40 p-3">
            <div className="text-[11px] uppercase tracking-wide font-semibold text-ink-muted mb-2">
              What&apos;s attached to this {scopeLabel}
            </div>
            {loadingPreview ? (
              <div className="text-[12px] text-ink-muted flex items-center gap-2">
                <Loader2Icon size={12} className="animate-spin" /> Counting…
              </div>
            ) : preview && preview.summary.length > 0 ? (
              <ul className="text-[12px] text-ink-soft space-y-0.5">
                {preview.summary.map((line, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-danger-400 shrink-0" />
                    {line}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-[12px] text-ink-muted">
                Nothing else attached. Safe to delete directly.
              </div>
            )}
          </div>
        )}

        {isDeclaration && locked && (
          <div className="rounded-md border border-danger-300 bg-danger-50 p-3 flex gap-2">
            <AlertTriangleIcon size={14} className="text-danger-600 shrink-0 mt-0.5" />
            <div className="text-[12px] text-danger-900">
              <strong>This declaration is already {status?.toUpperCase()}.</strong>
              {' '}Deleting it removes the AED filing record from cifra. The audit log
              keeps the deletion event, but you&apos;ll lose the line-level detail.
              Only do this if the declaration was a test or mistake.
            </div>
          </div>
        )}

        {/* Two paths for client/entity */}
        {!isDeclaration ? (
          <div className="grid md:grid-cols-2 gap-3">
            {/* Archive path */}
            <div className="rounded-lg border border-border p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-ink">
                <ArchiveIcon size={14} className="text-brand-500" />
                <strong className="text-[13px]">Archive only (safe)</strong>
              </div>
              <p className="text-[11.5px] text-ink-soft leading-relaxed">
                Soft-delete: the {scopeLabel} disappears from lists but the data stays in the database for audit.{' '}
                {scope === 'client' && 'Only works when the client has no active entities.'}
              </p>
              <button
                onClick={archiveOnly}
                disabled={busy}
                className="mt-auto h-9 px-3 rounded-md bg-surface border border-border-strong text-[12.5px] font-medium text-ink hover:bg-surface-alt disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
              >
                <ArchiveIcon size={12} /> Archive
              </button>
            </div>

            {/* Delete path */}
            <div className="rounded-lg border border-danger-200 bg-danger-50/40 p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-danger-700">
                <Trash2Icon size={14} />
                <strong className="text-[13px]">Delete permanently (cascade)</strong>
              </div>
              <p className="text-[11.5px] text-danger-900 leading-relaxed">
                Removes the {scopeLabel} AND everything attached. Cannot be undone.
              </p>
              <label className="block">
                <span className="text-[10.5px] uppercase tracking-wide font-semibold text-danger-800">
                  Type <code className="font-mono bg-white/80 px-1 rounded">{targetName}</code> to confirm
                </span>
                <input
                  value={typed}
                  onChange={e => setTyped(e.target.value)}
                  className="mt-1 w-full border border-danger-300 rounded px-2 py-1.5 text-[12.5px] focus:outline-none focus:ring-1 focus:ring-danger-400"
                  placeholder={targetName}
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                />
              </label>
              <button
                onClick={cascadeDelete}
                disabled={busy || !typedMatches}
                className="mt-auto h-9 px-3 rounded-md bg-danger-600 text-white text-[12.5px] font-semibold hover:bg-danger-700 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5"
              >
                {busy ? <Loader2Icon size={12} className="animate-spin" /> : <Trash2Icon size={12} />}
                Delete permanently
              </button>
            </div>
          </div>
        ) : (
          // Declaration: a single destructive action.
          <div className="rounded-lg border border-danger-200 bg-danger-50/40 p-4 space-y-3">
            <p className="text-[12px] text-danger-900 leading-relaxed">
              {locked ? (
                <>Declaring this irreversible removes the filing record. The audit log retains the delete event.</>
              ) : (
                <>This removes the declaration and all invoices / lines / documents under it.</>
              )}
            </p>
            <label className="block">
              <span className="text-[10.5px] uppercase tracking-wide font-semibold text-danger-800">
                Type <code className="font-mono bg-white/80 px-1 rounded">{targetName}</code> to confirm
              </span>
              <input
                value={typed}
                onChange={e => setTyped(e.target.value)}
                className="mt-1 w-full border border-danger-300 rounded px-2 py-1.5 text-[12.5px] focus:outline-none focus:ring-1 focus:ring-danger-400"
                placeholder={targetName}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
              />
            </label>
            <button
              onClick={cascadeDelete}
              disabled={busy || !typedMatches}
              className="h-9 px-3 rounded-md bg-danger-600 text-white text-[12.5px] font-semibold hover:bg-danger-700 disabled:opacity-40 inline-flex items-center gap-1.5"
            >
              {busy ? <Loader2Icon size={12} className="animate-spin" /> : <Trash2Icon size={12} />}
              Delete permanently
            </button>
          </div>
        )}

        <div className="text-[10.5px] text-ink-muted italic">
          All deletes are recorded in the audit log (action = delete_cascade) with the
          blast-radius counts. That event stays in the DB even after the {scopeLabel}
          is gone.
        </div>
      </div>
    </Modal>
  );
}
