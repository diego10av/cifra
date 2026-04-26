'use client';

// ════════════════════════════════════════════════════════════════════════
// MatterDocsClosing — two sub-sections on the matter detail page:
//   1. Documents: attached URLs (SharePoint / iManage / Drive) with
//      filename, kind, notes. Add / remove / click to open in new tab.
//   2. Closing checklist: the 7 canonical steps. Toggle checkboxes
//      mark steps complete. A matter cannot transition to status =
//      closed while any step is unchecked (enforced server-side).
// ════════════════════════════════════════════════════════════════════════

import { useEffect, useState, useCallback } from 'react';
import { PlusIcon, ExternalLinkIcon, Trash2Icon, CheckCircle2Icon, CircleIcon } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/Toaster';
import { formatDate } from '@/lib/crm-types';

interface Document {
  id: string;
  filename: string;
  file_path: string;
  kind: string | null;
  notes: string | null;
  uploaded_at: string;
  uploaded_by: string | null;
}

interface ClosingStep {
  step_name: string;
  label: string;
  completed: boolean;
  completed_at: string | null;
  completed_by: string | null;
}

const DOC_KINDS = [
  { value: 'engagement_letter', label: 'Engagement letter' },
  { value: 'draft',             label: 'Draft' },
  { value: 'signed_document',   label: 'Signed document' },
  { value: 'opinion',           label: 'Opinion' },
  { value: 'research',          label: 'Research' },
  { value: 'correspondence',    label: 'Correspondence' },
  { value: 'other',             label: 'Other' },
];

export function MatterDocsClosing({ matterId }: { matterId: string }) {
  const toast = useToast();
  const [docs, setDocs] = useState<Document[] | null>(null);
  const [steps, setSteps] = useState<ClosingStep[] | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/crm/matters/${matterId}/documents`, { cache: 'no-store' })
      .then(r => r.json()).then(setDocs).catch(() => setDocs([]));
    fetch(`/api/crm/matters/${matterId}/closing`, { cache: 'no-store' })
      .then(r => r.json()).then(setSteps).catch(() => setSteps([]));
  }, [matterId]);

  useEffect(() => { load(); }, [load]);

  async function removeDoc(id: string) {
    if (!confirm('Remove this document reference? The file itself stays wherever it lives.')) return;
    const res = await fetch(`/api/crm/documents/${id}`, { method: 'DELETE' });
    if (!res.ok) { toast.error('Remove failed'); return; }
    toast.success('Document unlinked');
    load();
  }

  async function toggleStep(stepName: string, nowCompleted: boolean) {
    const res = await fetch(`/api/crm/matters/${matterId}/closing`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step_name: stepName, completed: nowCompleted }),
    });
    if (!res.ok) { toast.error('Update failed'); return; }
    load();
  }

  if (docs === null || steps === null) {
    return <div className="text-sm text-ink-muted italic px-3 py-4">Loading documents…</div>;
  }

  const stepsDone = steps.filter(s => s.completed).length;
  const stepsTotal = steps.length;
  const checklistPct = stepsTotal > 0 ? (stepsDone / stepsTotal) * 100 : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
      {/* Documents column */}
      <div className="border border-border rounded-lg bg-white">
        <div className="px-3 py-2 flex items-center justify-between border-b border-border">
          <span className="text-sm uppercase tracking-wide font-semibold text-ink-muted">
            Documents ({docs.length})
          </span>
          <Button variant="primary" size="sm" icon={<PlusIcon size={12} />} onClick={() => setAddOpen(true)}>
            Add
          </Button>
        </div>
        <div className="p-3">
          {docs.length === 0 ? (
            <p className="text-sm text-ink-muted italic">No documents linked yet. Attach your engagement letter, drafts, and final deliverables with a URL.</p>
          ) : (
            <ul className="space-y-1.5">
              {docs.map(d => (
                <li key={d.id} className="flex items-start gap-2 border border-border rounded-md px-2 py-1.5">
                  <a href={d.file_path} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0 text-sm font-medium text-brand-700 hover:underline inline-flex items-center gap-1 truncate">
                    {d.filename}
                    <ExternalLinkIcon size={10} />
                  </a>
                  {d.kind && (
                    <span className="text-2xs uppercase tracking-wide bg-surface-alt border border-border rounded px-1.5 py-0.5 text-ink-muted shrink-0">
                      {d.kind.replace(/_/g, ' ')}
                    </span>
                  )}
                  <span className="text-2xs text-ink-muted shrink-0 tabular-nums">{formatDate(d.uploaded_at)}</span>
                  <button onClick={() => removeDoc(d.id)} className="text-danger-600 hover:text-danger-800 shrink-0" title="Unlink">
                    <Trash2Icon size={11} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Closing checklist */}
      <div className="border border-border rounded-lg bg-white">
        <div className="px-3 py-2 flex items-center justify-between border-b border-border">
          <span className="text-sm uppercase tracking-wide font-semibold text-ink-muted">
            Closing checklist ({stepsDone}/{stepsTotal})
          </span>
          <span className={`text-xs font-medium ${checklistPct === 100 ? 'text-emerald-700' : 'text-ink-muted'}`}>
            {checklistPct.toFixed(0)}%
          </span>
        </div>
        <div className="px-3 py-2 border-b border-border">
          <div className="h-1.5 bg-surface-alt rounded overflow-hidden">
            <div className={`h-full rounded ${checklistPct === 100 ? 'bg-emerald-500' : 'bg-brand-500'}`} style={{ width: `${checklistPct}%` }} />
          </div>
        </div>
        <ul className="divide-y divide-border">
          {steps.map(s => (
            <li key={s.step_name} className="px-3 py-2 flex items-start gap-2.5 text-sm">
              <button
                onClick={() => toggleStep(s.step_name, !s.completed)}
                className={`shrink-0 mt-0.5 ${s.completed ? 'text-emerald-600' : 'text-ink-muted hover:text-ink'}`}
                title={s.completed ? 'Mark as pending' : 'Mark as complete'}
              >
                {s.completed
                  ? <CheckCircle2Icon size={16} />
                  : <CircleIcon size={16} />
                }
              </button>
              <div className="flex-1 min-w-0">
                <div className={s.completed ? 'line-through text-ink-muted' : 'text-ink'}>
                  {s.label}
                </div>
                {s.completed && s.completed_at && (
                  <div className="text-2xs text-ink-faint">
                    ✓ {formatDate(s.completed_at)} {s.completed_by && `· ${s.completed_by}`}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
        {checklistPct < 100 && (
          <div className="px-3 py-2 border-t border-border text-xs text-ink-muted italic">
            Matter cannot transition to <strong>closed</strong> until all steps are complete.
          </div>
        )}
      </div>

      {addOpen && (
        <AddDocModal
          matterId={matterId}
          onClose={() => setAddOpen(false)}
          onSaved={() => { setAddOpen(false); load(); }}
        />
      )}
    </div>
  );
}

function AddDocModal({
  matterId, onClose, onSaved,
}: {
  matterId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [url, setUrl] = useState('');
  const [filename, setFilename] = useState('');
  const [kind, setKind] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!url.trim()) { toast.error('URL required'); return; }
    if (!filename.trim()) { toast.error('Filename required'); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/crm/matters/${matterId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_path: url.trim(), filename: filename.trim(), kind: kind || null, notes: notes || null }),
      });
      if (!res.ok) { toast.error('Add failed'); return; }
      toast.success('Document linked');
      onSaved();
    } finally { setSaving(false); }
  }

  return (
    <Modal
      open={true}
      onClose={saving ? () => {} : onClose}
      title="Attach document"
      size="md"
      footer={
        <div className="flex items-center gap-2 justify-end">
          <button onClick={onClose} disabled={saving} className="h-8 px-3 rounded-md border border-border text-sm text-ink-soft hover:bg-surface-alt disabled:opacity-40">Cancel</button>
          <Button variant="primary" size="sm" onClick={submit} loading={saving}>Attach</Button>
        </div>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="block text-xs uppercase tracking-wide font-semibold text-ink-muted mb-1">URL *</label>
          <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://sharepoint.com/..." className="w-full h-9 px-2.5 text-sm border border-border rounded-md" />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wide font-semibold text-ink-muted mb-1">Filename *</label>
          <input value={filename} onChange={e => setFilename(e.target.value)} placeholder="Engagement letter — signed.pdf" className="w-full h-9 px-2.5 text-sm border border-border rounded-md" />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wide font-semibold text-ink-muted mb-1">Kind</label>
          <select value={kind} onChange={e => setKind(e.target.value)} className="w-full h-9 px-2.5 text-sm border border-border rounded-md bg-white">
            <option value="">—</option>
            {DOC_KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wide font-semibold text-ink-muted mb-1">Notes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full px-2.5 py-2 text-sm border border-border rounded-md resize-y" />
        </div>
      </div>
    </Modal>
  );
}
