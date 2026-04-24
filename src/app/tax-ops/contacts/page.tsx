'use client';

// /tax-ops/contacts — Global contact book (stint 42.B).
//
// Reverse index of every CSP contact across entities + filings.
// Main use case: when a contact's email changes, rename it once
// here and propagate to every row atomically (via /rename endpoint).

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeftIcon, SearchIcon, UsersIcon, EditIcon, XIcon, CheckIcon,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { CrmErrorBox } from '@/components/crm/CrmErrorBox';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/Toaster';

interface Contact {
  email_norm: string;
  name: string | null;
  email: string | null;
  role: string | null;
  entity_count: number;
  filing_count: number;
  sample_entities: string[];
}

interface Response {
  contacts: Contact[];
  total: number;
}

export default function ContactsPage() {
  const [data, setData] = useState<Response | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Contact | null>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/tax-ops/contacts');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json() as Response);
      setError(null);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (error) return <CrmErrorBox message={error} onRetry={load} />;
  if (!data) return <PageSkeleton />;

  const q = search.toLowerCase();
  const filtered = q === ''
    ? data.contacts
    : data.contacts.filter(c =>
        c.email_norm.includes(q) ||
        (c.name?.toLowerCase().includes(q) ?? false) ||
        (c.role?.toLowerCase().includes(q) ?? false));

  return (
    <div className="space-y-4">
      <Link href="/tax-ops/settings" className="inline-flex items-center gap-1 text-[12px] text-ink-muted hover:text-ink">
        <ArrowLeftIcon size={12} /> Back to settings
      </Link>

      <PageHeader
        title="Contacts book"
        subtitle={`${data.total} unique contact${data.total === 1 ? '' : 's'} across every entity + filing. Rename once, propagate everywhere.`}
      />

      <div className="flex items-center gap-2">
        <SearchIcon size={14} className="text-ink-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by name, email or role"
          className="flex-1 max-w-md px-2 py-1 text-[12.5px] border border-border rounded-md bg-surface"
        />
        <span className="text-[11.5px] text-ink-muted ml-auto">
          {filtered.length} shown
        </span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={data.total === 0 ? 'No contacts yet' : 'No matches'}
          description={data.total === 0
            ? 'Add a contact on any entity or filing and it will appear here.'
            : 'Clear the filter above or try a different term.'}
        />
      ) : (
        <div className="rounded-md border border-border bg-surface overflow-hidden">
          <table className="w-full text-[12.5px]">
            <thead className="bg-surface-alt text-ink-muted">
              <tr className="text-left">
                <th className="px-3 py-1.5 font-medium">Name</th>
                <th className="px-3 py-1.5 font-medium">Email</th>
                <th className="px-3 py-1.5 font-medium">Role</th>
                <th className="px-3 py-1.5 font-medium text-right">Entities</th>
                <th className="px-3 py-1.5 font-medium text-right">Filings</th>
                <th className="px-3 py-1.5 font-medium">Sample</th>
                <th className="px-3 py-1.5 w-[80px]"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.email_norm} className="border-t border-border/70 hover:bg-surface-alt/40">
                  <td className="px-3 py-1.5 font-medium">{c.name ?? <span className="text-ink-muted italic">—</span>}</td>
                  <td className="px-3 py-1.5 font-mono text-[11.5px] text-ink-soft">{c.email ?? c.email_norm}</td>
                  <td className="px-3 py-1.5 text-ink-soft">{c.role ?? <span className="text-ink-muted italic">—</span>}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{c.entity_count}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{c.filing_count}</td>
                  <td className="px-3 py-1.5 text-ink-muted text-[11.5px] truncate max-w-[260px]" title={c.sample_entities.join(', ')}>
                    {c.sample_entities.slice(0, 3).join(', ')}
                    {c.sample_entities.length > 3 ? '…' : ''}
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <button
                      type="button"
                      onClick={() => setEditing(c)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded border border-border hover:border-brand-500 hover:text-brand-700"
                    >
                      <EditIcon size={11} /> Rename
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <RenameModal
          contact={editing}
          onClose={() => setEditing(null)}
          onApplied={async () => {
            setEditing(null);
            await load();
            toast.success('Contact updated everywhere');
          }}
        />
      )}

      <div className="rounded-md border border-border bg-surface-alt/40 px-4 py-2 text-[11.5px] text-ink-muted">
        <UsersIcon size={12} className="inline mr-1" />
        Tip: click <em>Rename</em> to change name / email / role for a contact. The update
        propagates to every entity + filing that references the old email in a single
        transaction (audit-logged).
      </div>
    </div>
  );
}

function RenameModal({
  contact, onClose, onApplied,
}: {
  contact: Contact;
  onClose: () => void;
  onApplied: () => void | Promise<void>;
}) {
  const [name, setName] = useState(contact.name ?? '');
  const [email, setEmail] = useState(contact.email ?? contact.email_norm);
  const [role, setRole] = useState(contact.role ?? '');
  const [preview, setPreview] = useState<{ entity_rows_affected: number; filing_rows_affected: number } | null>(null);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  function buildBody(): Record<string, string> {
    const body: Record<string, string> = { old_email: contact.email_norm };
    if (name.trim() !== (contact.name ?? '').trim()) body.new_name = name.trim();
    if (email.trim().toLowerCase() !== contact.email_norm) body.new_email = email.trim();
    if (role.trim() !== (contact.role ?? '').trim()) body.new_role = role.trim();
    return body;
  }

  async function runPreview() {
    setError(null);
    const body = buildBody();
    if (Object.keys(body).length <= 1) {
      setError('Nothing to change. Edit name / email / role first.');
      return;
    }
    try {
      const res = await fetch('/api/tax-ops/contacts/rename?dry_run=1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b?.error ?? `HTTP ${res.status}`);
      }
      const p = await res.json() as { entity_rows_affected: number; filing_rows_affected: number };
      setPreview(p);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    }
  }

  async function apply() {
    if (!preview) return;
    setApplying(true);
    setError(null);
    try {
      const res = await fetch('/api/tax-ops/contacts/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildBody()),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b?.error ?? `HTTP ${res.status}`);
      }
      await onApplied();
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
      toast.error('Rename failed');
    } finally {
      setApplying(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/30" />
      <div
        role="dialog"
        aria-label="Rename contact"
        className="relative bg-surface border border-border rounded-lg shadow-xl max-w-md w-full p-4 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <EditIcon size={14} className="text-brand-500" />
          <h2 className="text-[14px] font-semibold text-ink flex-1">Rename contact</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-ink-muted hover:text-ink p-1"
          >
            <XIcon size={14} />
          </button>
        </div>

        <p className="text-[11.5px] text-ink-muted">
          Changes to name / email / role propagate to every entity + filing
          referencing the old email (<span className="font-mono">{contact.email_norm}</span>).
        </p>

        <div className="grid gap-2 text-[12.5px]">
          <label className="block">
            <span className="block text-[11px] font-medium text-ink-muted mb-1">Name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setPreview(null); }}
              className="w-full px-2 py-1 border border-border rounded bg-surface"
            />
          </label>
          <label className="block">
            <span className="block text-[11px] font-medium text-ink-muted mb-1">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setPreview(null); }}
              className="w-full px-2 py-1 border border-border rounded bg-surface font-mono"
            />
          </label>
          <label className="block">
            <span className="block text-[11px] font-medium text-ink-muted mb-1">Role</span>
            <input
              type="text"
              value={role}
              onChange={(e) => { setRole(e.target.value); setPreview(null); }}
              className="w-full px-2 py-1 border border-border rounded bg-surface"
              placeholder="e.g. Accountant, Partner, CSP"
            />
          </label>
        </div>

        {error && (
          <div className="text-[11.5px] text-danger-700 bg-danger-50 border border-danger-200 rounded px-2 py-1">
            {error}
          </div>
        )}

        {preview && (
          <div className="text-[11.5px] bg-brand-50 border border-brand-200 rounded px-2 py-1.5 text-brand-900">
            Will update <strong>{preview.entity_rows_affected}</strong> entit{preview.entity_rows_affected === 1 ? 'y' : 'ies'} and <strong>{preview.filing_rows_affected}</strong> filing{preview.filing_rows_affected === 1 ? '' : 's'}.
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 text-[12px] rounded-md border border-border hover:bg-surface-alt"
          >
            Cancel
          </button>
          {!preview ? (
            <button
              type="button"
              onClick={() => void runPreview()}
              className="px-3 py-1 text-[12px] rounded-md border border-border hover:bg-surface-alt"
            >
              Preview changes
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void apply()}
              disabled={applying}
              className="inline-flex items-center gap-1 px-3 py-1 text-[12px] rounded-md bg-brand-500 hover:bg-brand-600 text-white disabled:opacity-50"
            >
              <CheckIcon size={11} />
              {applying ? 'Applying…' : 'Apply'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
