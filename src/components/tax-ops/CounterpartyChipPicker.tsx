'use client';

// CounterpartyChipPicker — autocomplete + create-new for the
// counterparty directory. Used wherever you need to attach a stakeholder
// to a task: engagement header (deal-wide), sub-task row (workstream),
// or the directory page itself when seeding the list.
//
// Stint 84.

import { useEffect, useState, useRef } from 'react';
import { PlusIcon, SearchIcon, XIcon, CheckIcon } from 'lucide-react';

export interface Counterparty {
  id: string;
  display_name: string;
  organization: string | null;
  contact_name: string | null;
  contact_email: string | null;
  jurisdiction: string | null;
  role: string | null;
  side: string;
}

const ROLE_OPTIONS: Array<{ value: string; label: string; side: 'internal' | 'external' }> = [
  { value: 'tax_counsel',         label: 'Tax counsel (external)',     side: 'external' },
  { value: 'corporate_counsel',   label: 'Corporate counsel (ext)',    side: 'external' },
  { value: 'csp',                 label: 'CSP / fiduciary',            side: 'external' },
  { value: 'auditor',             label: 'Auditor',                    side: 'external' },
  { value: 'notary',              label: 'Notary',                     side: 'external' },
  { value: 'bank',                label: 'Bank',                       side: 'external' },
  { value: 'client_contact',      label: 'Client contact',             side: 'external' },
  { value: 'internal_tax',        label: 'Internal — tax team',        side: 'internal' },
  { value: 'internal_corporate',  label: 'Internal — corporate team',  side: 'internal' },
  { value: 'internal_admin',      label: 'Internal — admin',           side: 'internal' },
  { value: 'other',               label: 'Other',                      side: 'external' },
];

/** Picker invoked from a "+ Add stakeholder" button. */
export function CounterpartyChipPicker({
  onPick,
  excludeIds = [],
  triggerLabel = '+ Add stakeholder',
}: {
  onPick: (counterpartyId: string, roleInTask: string) => void | Promise<void>;
  excludeIds?: string[];
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Counterparty[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({
    display_name: '', organization: '', contact_name: '',
    contact_email: '', jurisdiction: '', role: 'tax_counsel', side: 'external',
  });
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Search with debounce
  useEffect(() => {
    if (!open) return;
    const handle = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/tax-ops/counterparties${q ? `?q=${encodeURIComponent(q)}` : ''}`);
        if (r.ok) {
          const body = await r.json() as { counterparties: Counterparty[] };
          setResults((body.counterparties ?? []).filter(c => !excludeIds.includes(c.id)));
        }
      } finally {
        setLoading(false);
      }
    }, 150);
    return () => clearTimeout(handle);
  }, [q, open, excludeIds]);

  // Outside click closes
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  async function pick(c: Counterparty) {
    await onPick(c.id, 'responsible');
    setOpen(false);
    setQ('');
  }

  async function createAndPick() {
    const name = draft.display_name.trim();
    if (!name) return;
    const res = await fetch('/api/tax-ops/counterparties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        display_name: name,
        organization: draft.organization.trim() || null,
        contact_name: draft.contact_name.trim() || null,
        contact_email: draft.contact_email.trim() || null,
        jurisdiction: draft.jurisdiction.trim() || null,
        role: draft.role,
        side: draft.side,
      }),
    });
    if (!res.ok) return;
    const { id } = await res.json() as { id: string };
    await onPick(id, 'responsible');
    setOpen(false);
    setCreating(false);
    setDraft({
      display_name: '', organization: '', contact_name: '',
      contact_email: '', jurisdiction: '', role: 'tax_counsel', side: 'external',
    });
    setQ('');
  }

  return (
    <div className="relative inline-block" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="inline-flex items-center gap-1 h-7 px-2 text-2xs uppercase tracking-wide font-semibold text-ink-muted border border-dashed border-border rounded-md hover:bg-surface-alt hover:text-ink hover:border-border-strong transition-colors"
      >
        <PlusIcon size={11} /> {triggerLabel}
      </button>
      {open && (
        <div className="absolute z-popover top-full mt-1 left-0 w-[340px] rounded-md border border-border bg-surface shadow-md p-2">
          {!creating ? (
            <>
              <div className="flex items-center gap-1.5 mb-1.5">
                <SearchIcon size={12} className="text-ink-muted" />
                <input
                  autoFocus
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  placeholder="Search by name, org, email…"
                  className="flex-1 px-2 py-1 text-sm border border-border rounded bg-surface"
                />
              </div>
              <div className="max-h-[260px] overflow-y-auto">
                {loading && (
                  <div className="text-2xs text-ink-faint italic p-2">Searching…</div>
                )}
                {!loading && results.length === 0 && (
                  <div className="text-2xs text-ink-muted italic p-2">
                    {q.trim() ? 'No matches.' : 'No counterparties yet.'}
                  </div>
                )}
                {!loading && results.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => void pick(c)}
                    className="w-full text-left px-2 py-1.5 rounded hover:bg-surface-alt/50 flex items-center gap-2"
                  >
                    <SideChip side={c.side} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-ink truncate">{c.display_name}</div>
                      <div className="text-2xs text-ink-muted truncate">
                        {[c.role && humanRole(c.role), c.organization, c.jurisdiction].filter(Boolean).join(' · ') || '—'}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              <div className="border-t border-divider mt-1.5 pt-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setCreating(true);
                    if (q.trim()) setDraft(d => ({ ...d, display_name: q.trim() }));
                  }}
                  className="w-full text-left px-2 py-1 text-xs text-brand-700 hover:bg-brand-50 rounded inline-flex items-center gap-1"
                >
                  <PlusIcon size={11} /> Create new counterparty
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-2xs uppercase tracking-wide font-semibold text-ink-muted">New counterparty</span>
                <button
                  type="button"
                  onClick={() => setCreating(false)}
                  className="text-ink-muted hover:text-ink"
                  aria-label="Cancel"
                >
                  <XIcon size={12} />
                </button>
              </div>
              <input
                value={draft.display_name}
                onChange={e => setDraft({ ...draft, display_name: e.target.value })}
                placeholder="Display name (e.g. Müller & Partners (Zurich))"
                autoFocus
                className="w-full px-2 py-1 text-sm border border-border rounded bg-surface"
              />
              <div className="grid grid-cols-2 gap-1.5">
                <input
                  value={draft.contact_name}
                  onChange={e => setDraft({ ...draft, contact_name: e.target.value })}
                  placeholder="Contact name"
                  className="px-2 py-1 text-sm border border-border rounded bg-surface"
                />
                <input
                  value={draft.contact_email}
                  onChange={e => setDraft({ ...draft, contact_email: e.target.value })}
                  placeholder="Email"
                  type="email"
                  className="px-2 py-1 text-sm border border-border rounded bg-surface"
                />
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <select
                  value={draft.role}
                  onChange={e => {
                    const next = e.target.value;
                    const meta = ROLE_OPTIONS.find(r => r.value === next);
                    setDraft({ ...draft, role: next, side: meta?.side ?? draft.side });
                  }}
                  className="col-span-2 px-2 py-1 text-sm border border-border rounded bg-surface"
                >
                  {ROLE_OPTIONS.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
                <input
                  value={draft.jurisdiction}
                  onChange={e => setDraft({ ...draft, jurisdiction: e.target.value.toUpperCase().slice(0, 2) })}
                  placeholder="CC"
                  maxLength={2}
                  className="px-2 py-1 text-sm border border-border rounded bg-surface font-mono uppercase"
                />
              </div>
              <button
                type="button"
                onClick={() => void createAndPick()}
                disabled={!draft.display_name.trim()}
                className="w-full inline-flex items-center justify-center gap-1 h-8 rounded bg-brand-500 text-white text-xs font-semibold hover:bg-brand-600 disabled:opacity-50"
              >
                <CheckIcon size={11} /> Create &amp; attach
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Read-only chip representation of a counterparty link on a task. */
export function CounterpartyChip({
  counterparty,
  onRemove,
  size = 'sm',
}: {
  counterparty: {
    counterparty_id: string;
    display_name: string;
    side: string;
    role: string | null;
    jurisdiction: string | null;
    role_in_task: string | null;
  };
  onRemove?: () => void | Promise<void>;
  size?: 'sm' | 'xs';
}) {
  const tone = counterparty.side === 'internal'
    ? 'bg-info-50 text-info-800 border-info-200'
    : 'bg-warning-50 text-warning-800 border-warning-200';
  const dim = size === 'xs' ? 'text-2xs px-1.5 py-0.5' : 'text-xs px-2 py-0.5';
  const label = counterparty.role_in_task && counterparty.role_in_task !== 'responsible'
    ? ` · ${counterparty.role_in_task}`
    : '';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-medium ${dim} ${tone}`}
      title={[
        counterparty.role && humanRole(counterparty.role),
        counterparty.jurisdiction,
        counterparty.role_in_task && `Role: ${counterparty.role_in_task}`,
      ].filter(Boolean).join(' · ')}
    >
      <span className="truncate max-w-[180px]">
        {counterparty.display_name}{label}
      </span>
      {onRemove && (
        <button
          type="button"
          onClick={() => void onRemove()}
          aria-label="Remove counterparty"
          className="text-ink-muted hover:text-danger-600"
        >
          <XIcon size={10} />
        </button>
      )}
    </span>
  );
}

function SideChip({ side }: { side: string }) {
  const tone = side === 'internal'
    ? 'bg-info-50 text-info-700 border-info-200'
    : 'bg-warning-50 text-warning-700 border-warning-200';
  return (
    <span className={`text-2xs px-1 rounded border font-semibold uppercase tracking-wide ${tone}`}>
      {side === 'internal' ? 'Int' : 'Ext'}
    </span>
  );
}

function humanRole(r: string): string {
  const m = ROLE_OPTIONS.find(o => o.value === r);
  return m?.label ?? r.replace(/_/g, ' ');
}
