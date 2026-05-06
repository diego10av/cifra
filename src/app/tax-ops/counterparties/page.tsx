'use client';

// /tax-ops/counterparties — directory of stakeholders Diego works with
// across engagements. Reusable across tasks. Stint 84.
//
// Distinct from /tax-ops/contacts (which is a reverse-index of CSP
// contacts on tax filings). This is the project-management side: people
// involved in transaction workflows (foreign tax counsel, mercantil team,
// notary, client CFO).

import { useEffect, useState, useCallback } from 'react';
import { PlusIcon, SearchIcon, EditIcon, ArchiveIcon, RotateCcwIcon } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Card } from '@/components/ui/Card';
import { useToast } from '@/components/Toaster';

interface Counterparty {
  id: string;
  display_name: string;
  organization: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  jurisdiction: string | null;
  role: string | null;
  side: string;
  notes: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

const ROLE_OPTIONS = [
  { value: 'tax_counsel',         label: 'Tax counsel' },
  { value: 'corporate_counsel',   label: 'Corporate counsel' },
  { value: 'csp',                 label: 'CSP / fiduciary' },
  { value: 'auditor',             label: 'Auditor' },
  { value: 'notary',              label: 'Notary' },
  { value: 'bank',                label: 'Bank' },
  { value: 'client_contact',      label: 'Client contact' },
  { value: 'internal_tax',        label: 'Internal — tax team' },
  { value: 'internal_corporate',  label: 'Internal — corporate team' },
  { value: 'internal_admin',      label: 'Internal — admin' },
  { value: 'other',               label: 'Other' },
] as const;

function humanRole(r: string | null): string {
  if (!r) return '—';
  return ROLE_OPTIONS.find(o => o.value === r)?.label ?? r.replace(/_/g, ' ');
}

export default function CounterpartiesPage() {
  const [items, setItems] = useState<Counterparty[] | null>(null);
  const [search, setSearch] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [editing, setEditing] = useState<Counterparty | null>(null);
  const [creating, setCreating] = useState(false);
  const toast = useToast();

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (search.trim()) params.set('q', search.trim());
    if (includeArchived) params.set('include_archived', '1');
    const res = await fetch(`/api/tax-ops/counterparties?${params.toString()}`);
    if (res.ok) {
      const body = await res.json() as { counterparties: Counterparty[] };
      setItems(body.counterparties ?? []);
    }
  }, [search, includeArchived]);

  useEffect(() => { load(); }, [load]);

  async function archive(id: string) {
    const res = await fetch(`/api/tax-ops/counterparties/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      toast.error('Could not archive counterparty.');
      return;
    }
    toast.success('Counterparty archived.');
    load();
  }

  async function unarchive(id: string) {
    const res = await fetch(`/api/tax-ops/counterparties/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived_at: null }),
    });
    if (!res.ok) {
      toast.error('Could not restore counterparty.');
      return;
    }
    toast.success('Counterparty restored.');
    load();
  }

  if (items === null) return <PageSkeleton />;

  const active = items.filter(c => !c.archived_at);
  const archived = items.filter(c => !!c.archived_at);

  return (
    <div>
      <PageHeader
        title="Counterparties"
        subtitle="Stakeholders across engagements — foreign tax counsel, CSPs, notaries, internal teams, client contacts. Reusable across tasks."
        actions={
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600"
          >
            <PlusIcon size={13} /> New counterparty
          </button>
        }
      />

      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1 max-w-md">
          <SearchIcon size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, organisation, contact, email…"
            className="w-full h-8 pl-8 pr-3 text-sm border border-border rounded-md bg-surface"
          />
        </div>
        <label className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={e => setIncludeArchived(e.target.checked)}
          />
          Include archived
        </label>
      </div>

      {(creating || editing) && (
        <CounterpartyEditor
          initial={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { setCreating(false); setEditing(null); load(); }}
        />
      )}

      {items.length === 0 ? (
        <Card>
          <EmptyState
            illustration="empty_clients"
            title="No counterparties yet"
            description="Add the people you work with on transactions — foreign tax counsel, CSPs, internal teams. Once added, attach them to tasks/engagements."
            action={
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="h-9 px-4 rounded-md bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 inline-flex items-center gap-1.5"
              >
                <PlusIcon size={13} /> Create first counterparty
              </button>
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-alt border-b border-divider text-ink-muted">
              <tr>
                <Th>Name</Th>
                <Th>Role</Th>
                <Th>Side</Th>
                <Th>Contact</Th>
                <Th>Jurisdiction</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {active.map(c => (
                <Row
                  key={c.id}
                  c={c}
                  onEdit={() => setEditing(c)}
                  onArchive={() => archive(c.id)}
                  onUnarchive={() => unarchive(c.id)}
                />
              ))}
              {includeArchived && archived.map(c => (
                <Row
                  key={c.id}
                  c={c}
                  onEdit={() => setEditing(c)}
                  onArchive={() => archive(c.id)}
                  onUnarchive={() => unarchive(c.id)}
                />
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="px-4 py-2.5 text-left font-medium text-2xs uppercase tracking-[0.06em]">{children}</th>;
}

function Row({
  c, onEdit, onArchive, onUnarchive,
}: {
  c: Counterparty;
  onEdit: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
}) {
  const archived = !!c.archived_at;
  return (
    <tr className={`border-b border-divider last:border-0 hover:bg-surface-alt/50 transition-colors ${archived ? 'opacity-60' : ''}`}>
      <td className="px-4 py-3">
        <div className="font-medium text-ink">{c.display_name}</div>
        {c.organization && (
          <div className="text-xs text-ink-muted">{c.organization}</div>
        )}
      </td>
      <td className="px-4 py-3 text-ink-soft">{humanRole(c.role)}</td>
      <td className="px-4 py-3">
        <span className={`text-2xs px-1.5 py-0.5 rounded border font-medium uppercase tracking-wide ${
          c.side === 'internal'
            ? 'bg-info-50 text-info-700 border-info-200'
            : 'bg-warning-50 text-warning-700 border-warning-200'
        }`}>
          {c.side}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-ink-soft">
        {c.contact_name && <div>{c.contact_name}</div>}
        {c.contact_email && (
          <a href={`mailto:${c.contact_email}`} className="text-brand-700 hover:underline">{c.contact_email}</a>
        )}
        {!c.contact_name && !c.contact_email && <span className="text-ink-faint">—</span>}
      </td>
      <td className="px-4 py-3 text-ink-soft font-mono text-xs">{c.jurisdiction ?? '—'}</td>
      <td className="px-4 py-3 text-right">
        <div className="inline-flex items-center gap-1">
          <button
            type="button"
            onClick={onEdit}
            className="p-1.5 rounded text-ink-muted hover:text-brand-700 hover:bg-surface-alt"
            title="Edit"
          >
            <EditIcon size={13} />
          </button>
          {!archived ? (
            <button
              type="button"
              onClick={onArchive}
              className="p-1.5 rounded text-ink-muted hover:text-danger-700 hover:bg-danger-50"
              title="Archive"
            >
              <ArchiveIcon size={13} />
            </button>
          ) : (
            <button
              type="button"
              onClick={onUnarchive}
              className="p-1.5 rounded text-ink-muted hover:text-success-700 hover:bg-success-50"
              title="Restore"
            >
              <RotateCcwIcon size={13} />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── Editor (create + edit) ─────────────────────────────────────────────

function CounterpartyEditor({
  initial, onClose, onSaved,
}: {
  initial: Counterparty | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState({
    display_name: initial?.display_name ?? '',
    organization: initial?.organization ?? '',
    contact_name: initial?.contact_name ?? '',
    contact_email: initial?.contact_email ?? '',
    contact_phone: initial?.contact_phone ?? '',
    jurisdiction: initial?.jurisdiction ?? '',
    role: initial?.role ?? 'tax_counsel',
    side: initial?.side ?? 'external',
    notes: initial?.notes ?? '',
  });
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  async function save() {
    if (!draft.display_name.trim()) {
      toast.error('Display name is required.');
      return;
    }
    setSaving(true);
    try {
      const url = initial
        ? `/api/tax-ops/counterparties/${initial.id}`
        : '/api/tax-ops/counterparties';
      const method = initial ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...draft,
          display_name: draft.display_name.trim(),
          organization: draft.organization.trim() || null,
          contact_name: draft.contact_name.trim() || null,
          contact_email: draft.contact_email.trim() || null,
          contact_phone: draft.contact_phone.trim() || null,
          jurisdiction: draft.jurisdiction.trim() || null,
          notes: draft.notes.trim() || null,
        }),
      });
      if (!res.ok) {
        toast.error(initial ? 'Could not update.' : 'Could not create.');
        return;
      }
      toast.success(initial ? 'Counterparty updated.' : 'Counterparty created.');
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-ink">
          {initial ? `Edit ${initial.display_name}` : 'New counterparty'}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-ink-muted hover:text-ink"
        >
          Cancel
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Display name" required>
          <input
            value={draft.display_name}
            onChange={e => setDraft({ ...draft, display_name: e.target.value })}
            placeholder="e.g. Müller & Partners (Zurich)"
            className="w-full px-2 py-1.5 text-sm border border-border rounded bg-surface"
            autoFocus
          />
        </Field>
        <Field label="Organisation">
          <input
            value={draft.organization}
            onChange={e => setDraft({ ...draft, organization: e.target.value })}
            placeholder="e.g. Müller & Partners"
            className="w-full px-2 py-1.5 text-sm border border-border rounded bg-surface"
          />
        </Field>
        <Field label="Contact name">
          <input
            value={draft.contact_name}
            onChange={e => setDraft({ ...draft, contact_name: e.target.value })}
            placeholder="Hans Müller"
            className="w-full px-2 py-1.5 text-sm border border-border rounded bg-surface"
          />
        </Field>
        <Field label="Contact email">
          <input
            type="email"
            value={draft.contact_email}
            onChange={e => setDraft({ ...draft, contact_email: e.target.value })}
            placeholder="hans@muller.ch"
            className="w-full px-2 py-1.5 text-sm border border-border rounded bg-surface"
          />
        </Field>
        <Field label="Contact phone">
          <input
            value={draft.contact_phone}
            onChange={e => setDraft({ ...draft, contact_phone: e.target.value })}
            placeholder="+41 …"
            className="w-full px-2 py-1.5 text-sm border border-border rounded bg-surface"
          />
        </Field>
        <Field label="Jurisdiction (ISO-2)">
          <input
            value={draft.jurisdiction}
            onChange={e => setDraft({ ...draft, jurisdiction: e.target.value.toUpperCase().slice(0, 2) })}
            placeholder="CH"
            maxLength={2}
            className="w-full px-2 py-1.5 text-sm border border-border rounded bg-surface font-mono uppercase"
          />
        </Field>
        <Field label="Role">
          <select
            value={draft.role}
            onChange={e => setDraft({ ...draft, role: e.target.value })}
            className="w-full px-2 py-1.5 text-sm border border-border rounded bg-surface"
          >
            {ROLE_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Side">
          <select
            value={draft.side}
            onChange={e => setDraft({ ...draft, side: e.target.value })}
            className="w-full px-2 py-1.5 text-sm border border-border rounded bg-surface"
          >
            <option value="external">External</option>
            <option value="internal">Internal</option>
          </select>
        </Field>
      </div>
      <Field label="Notes">
        <textarea
          value={draft.notes}
          onChange={e => setDraft({ ...draft, notes: e.target.value })}
          rows={2}
          placeholder="Anything you want to remember about this counterparty."
          className="w-full px-2 py-1.5 text-sm border border-border rounded bg-surface"
        />
      </Field>
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={saving || !draft.display_name.trim()}
          className="h-8 px-4 rounded bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 disabled:opacity-50"
        >
          {saving ? 'Saving…' : initial ? 'Save changes' : 'Create counterparty'}
        </button>
      </div>
    </Card>
  );
}

function Field({
  label, children, required,
}: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block">
      <span className="block text-2xs uppercase tracking-wide font-semibold text-ink-muted mb-1">
        {label}{required && <span className="text-danger-600 ml-1">*</span>}
      </span>
      {children}
    </label>
  );
}
