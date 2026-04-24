'use client';

// /crm/outreach — MVP de captación de clientes.
// Stint 37.J. Diego pidió una pestaña bajo CRM para no olvidarlo y
// tener el plan siempre a mano. MVP intencionadamente mínimo: list +
// stage pipeline + inline edit. Deep playbook en docs/go-to-market-
// alt-fund-managers.md (stint 38.B).

import { useEffect, useState, useCallback, useMemo } from 'react';
import { PlusIcon, Trash2Icon, LayoutListIcon, LayoutGridIcon } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { CrmErrorBox } from '@/components/crm/CrmErrorBox';
import { DateBadge } from '@/components/crm/DateBadge';
import { Modal } from '@/components/ui/Modal';
import { crmLoadShape } from '@/lib/useCrmFetch';
import { useToast } from '@/components/Toaster';

interface Prospect {
  id: string;
  name: string;
  firm_type: string | null;
  company_name: string | null;
  contact_linkedin_url: string | null;
  contact_email: string | null;
  stage: string;
  next_action: string | null;
  next_action_date: string | null;
  notes: string | null;
  source: string | null;
  created_at: string;
  updated_at: string;
}

const STAGES = [
  { value: 'identified',      label: 'Identified', tone: 'bg-surface-alt text-ink-muted' },
  { value: 'warm',            label: 'Warm',       tone: 'bg-blue-100 text-blue-800' },
  { value: 'first_touch',     label: '1st touch',  tone: 'bg-amber-100 text-amber-800' },
  { value: 'meeting_booked',  label: 'Meeting',    tone: 'bg-brand-100 text-brand-800' },
  { value: 'proposal',        label: 'Proposal',   tone: 'bg-brand-200 text-brand-900' },
  { value: 'won',             label: 'Won',        tone: 'bg-green-200 text-green-900' },
  { value: 'lost',            label: 'Lost',       tone: 'bg-surface-alt text-ink-muted' },
];

const FIRM_TYPES = [
  { value: '',           label: '—' },
  { value: 'fondo',      label: 'Fund / asset mgr' },
  { value: 'boutique',   label: 'Boutique firm' },
  { value: 'big4',       label: 'Big 4' },
  { value: 'fiduciary',  label: 'Fiduciary' },
  { value: 'in_house',   label: 'In-house' },
  { value: 'other',      label: 'Other' },
];

const SOURCES = [
  { value: '',           label: '—' },
  { value: 'event',      label: 'Event' },
  { value: 'referral',   label: 'Referral' },
  { value: 'linkedin',   label: 'LinkedIn' },
  { value: 'cold_email', label: 'Cold email' },
  { value: 'other',      label: 'Other' },
];

type ViewMode = 'list' | 'board';

export default function OutreachPage() {
  const [rows, setRows] = useState<Prospect[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>('list');
  const [addOpen, setAddOpen] = useState(false);
  const toast = useToast();

  const load = useCallback(() => {
    crmLoadShape<Prospect[]>('/api/crm/outreach', b => (b as { prospects: Prospect[] }).prospects)
      .then(rows => { setRows(rows); setError(null); })
      .catch(e => { setError(String(e instanceof Error ? e.message : e)); setRows([]); });
  }, []);

  useEffect(() => { load(); }, [load]);

  async function patchProspect(id: string, patch: Record<string, unknown>) {
    const res = await fetch(`/api/crm/outreach/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      toast.error('Save failed');
      return;
    }
    load();
  }

  async function deleteProspect(id: string, name: string) {
    if (!confirm(`Delete prospect "${name}"?`)) return;
    const res = await fetch(`/api/crm/outreach/${id}`, { method: 'DELETE' });
    if (!res.ok) { toast.error('Delete failed'); return; }
    toast.success('Deleted');
    load();
  }

  const metrics = useMemo(() => {
    if (!rows) return null;
    const now = Date.now();
    const countBy = (s: string) => rows.filter(r => r.stage === s).length;
    const staleOver14 = rows.filter(r => {
      if (!['identified', 'warm', 'first_touch'].includes(r.stage)) return false;
      const ageDays = (now - new Date(r.created_at).getTime()) / (1000 * 60 * 60 * 24);
      return ageDays > 14;
    }).length;
    const thisWeekMeetings = rows.filter(r => r.stage === 'meeting_booked' && r.next_action_date && (
      (new Date(r.next_action_date).getTime() - now) <= 7 * 24 * 60 * 60 * 1000
    )).length;
    return {
      total: rows.length,
      warm: countBy('warm'),
      firstTouch: countBy('first_touch'),
      meetingBooked: countBy('meeting_booked'),
      proposal: countBy('proposal'),
      won: countBy('won'),
      thisWeekMeetings,
      staleOver14,
    };
  }, [rows]);

  if (rows === null) return <PageSkeleton />;

  return (
    <div>
      <PageHeader
        title="Outreach"
        subtitle="Captación de clientes — gestoras de fondos alternativos, boutiques, fiduciarias. Stage pipeline + next action per prospect. GTM playbook in docs/go-to-market-alt-fund-managers.md."
        actions={
          <div className="flex items-center gap-2">
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
            <button
              onClick={() => setAddOpen(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[12px] rounded-md bg-brand-500 hover:bg-brand-600 text-white"
            >
              <PlusIcon size={12} /> New prospect
            </button>
          </div>
        }
      />

      {metrics && metrics.total > 0 && (
        <div className="flex flex-wrap gap-2 mb-3 text-[11.5px]">
          <span className="inline-flex items-center px-2 py-1 rounded border border-border bg-surface">
            <span className="text-ink-muted mr-1">Total</span><strong>{metrics.total}</strong>
          </span>
          <span className="inline-flex items-center px-2 py-1 rounded border border-border bg-surface">
            <span className="text-ink-muted mr-1">Warm</span><strong>{metrics.warm}</strong>
          </span>
          <span className="inline-flex items-center px-2 py-1 rounded border border-border bg-surface">
            <span className="text-ink-muted mr-1">Meetings this week</span><strong>{metrics.thisWeekMeetings}</strong>
          </span>
          <span className="inline-flex items-center px-2 py-1 rounded border border-border bg-surface">
            <span className="text-ink-muted mr-1">Proposals</span><strong>{metrics.proposal}</strong>
          </span>
          <span className="inline-flex items-center px-2 py-1 rounded border border-border bg-surface">
            <span className="text-ink-muted mr-1">Won</span><strong className="text-green-700">{metrics.won}</strong>
          </span>
          {metrics.staleOver14 > 0 && (
            <span className="inline-flex items-center px-2 py-1 rounded border border-amber-400 bg-amber-50 text-amber-800">
              <strong>{metrics.staleOver14}</strong>&nbsp;untouched &gt; 14d
            </span>
          )}
        </div>
      )}

      {error && <CrmErrorBox message={error} onRetry={load} />}

      <NewProspectModal open={addOpen} onClose={() => setAddOpen(false)} onCreated={load} />

      {rows.length === 0 ? (
        <EmptyState
          title="No prospects yet"
          description="Start by adding your first 10 warm intros — LPEA / ALFI / AIMA network. Click 'New prospect' above."
        />
      ) : view === 'list' ? (
        <div className="rounded-md border border-border bg-surface overflow-auto">
          <table className="w-full text-[12px]">
            <thead className="bg-surface-alt text-ink-muted">
              <tr className="text-left">
                <th className="px-2 py-1.5 font-medium">Name</th>
                <th className="px-2 py-1.5 font-medium">Firm type</th>
                <th className="px-2 py-1.5 font-medium">Company</th>
                <th className="px-2 py-1.5 font-medium">Stage</th>
                <th className="px-2 py-1.5 font-medium">Next action</th>
                <th className="px-2 py-1.5 font-medium">When</th>
                <th className="px-2 py-1.5 font-medium">Source</th>
                <th className="px-2 py-1.5 w-[30px]"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(p => (
                <tr key={p.id} className="border-t border-border/70 hover:bg-surface-alt/40 align-top">
                  <td className="px-2 py-1.5">
                    <input
                      defaultValue={p.name}
                      onBlur={e => { if (e.target.value !== p.name) patchProspect(p.id, { name: e.target.value }); }}
                      className="font-medium bg-transparent hover:bg-surface-alt/50 px-1 rounded w-full"
                    />
                    <div className="flex gap-2 mt-0.5 text-[10.5px]">
                      {p.contact_linkedin_url && (
                        <a href={p.contact_linkedin_url} target="_blank" rel="noreferrer" className="text-brand-700 hover:underline">LinkedIn ↗</a>
                      )}
                      {p.contact_email && (
                        <a href={`mailto:${p.contact_email}`} className="text-brand-700 hover:underline">{p.contact_email}</a>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-1.5">
                    <select
                      value={p.firm_type ?? ''}
                      onChange={e => patchProspect(p.id, { firm_type: e.target.value || null })}
                      className="px-1 py-0 text-[11px] border border-border rounded bg-surface"
                    >
                      {FIRM_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      defaultValue={p.company_name ?? ''}
                      onBlur={e => { if ((e.target.value || null) !== p.company_name) patchProspect(p.id, { company_name: e.target.value || null }); }}
                      className="bg-transparent hover:bg-surface-alt/50 px-1 rounded w-full"
                      placeholder="—"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <select
                      value={p.stage}
                      onChange={e => patchProspect(p.id, { stage: e.target.value })}
                      className="px-1 py-0 text-[11px] border border-border rounded bg-surface"
                    >
                      {STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      defaultValue={p.next_action ?? ''}
                      onBlur={e => { if ((e.target.value || null) !== p.next_action) patchProspect(p.id, { next_action: e.target.value || null }); }}
                      placeholder="e.g. coffee · Follow-up DM"
                      className="bg-transparent hover:bg-surface-alt/50 px-1 rounded w-full text-[11.5px]"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="date"
                      defaultValue={p.next_action_date ?? ''}
                      onBlur={e => { if ((e.target.value || null) !== p.next_action_date) patchProspect(p.id, { next_action_date: e.target.value || null }); }}
                      className="px-1 py-0 text-[11px] border border-border rounded bg-surface tabular-nums"
                    />
                    {p.next_action_date && <div className="mt-0.5"><DateBadge value={p.next_action_date} mode="urgency" /></div>}
                  </td>
                  <td className="px-2 py-1.5">
                    <select
                      value={p.source ?? ''}
                      onChange={e => patchProspect(p.id, { source: e.target.value || null })}
                      className="px-1 py-0 text-[11px] border border-border rounded bg-surface"
                    >
                      {SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <button
                      onClick={() => deleteProspect(p.id, p.name)}
                      aria-label="Delete"
                      className="p-1 text-ink-muted hover:text-danger-600"
                    >
                      <Trash2Icon size={11} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <BoardView rows={rows} onMove={(id, stage) => patchProspect(id, { stage })} />
      )}
    </div>
  );
}

// ─── Board view ───────────────────────────────────────────────────────

function BoardView({
  rows, onMove,
}: {
  rows: Prospect[];
  onMove: (id: string, stage: string) => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const visibleStages = STAGES.filter(s => s.value !== 'lost');

  function handleDrop(stage: string) {
    if (!dragId) return;
    onMove(dragId, stage);
    setDragId(null);
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {visibleStages.map(st => {
        const items = rows.filter(p => p.stage === st.value);
        return (
          <div
            key={st.value}
            onDragOver={e => e.preventDefault()}
            onDrop={() => handleDrop(st.value)}
            className="rounded-md border border-border bg-surface-alt/30 min-h-[200px]"
          >
            <div className="px-3 py-2 border-b border-border bg-surface-alt text-[12px] font-semibold">
              {st.label} <span className="text-ink-muted font-normal">({items.length})</span>
            </div>
            <div className="p-2 space-y-1.5">
              {items.map(p => (
                <div
                  key={p.id}
                  draggable
                  onDragStart={() => setDragId(p.id)}
                  className="rounded border border-border bg-surface p-2 cursor-grab text-[11.5px]"
                >
                  <div className="font-medium text-ink">{p.name}</div>
                  {p.company_name && <div className="text-[10.5px] text-ink-muted">{p.company_name}</div>}
                  {p.next_action_date && (
                    <div className="mt-1">
                      <DateBadge value={p.next_action_date} mode="urgency" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── New prospect modal ──────────────────────────────────────────────

function NewProspectModal({
  open, onClose, onCreated,
}: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [firmType, setFirmType] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [email, setEmail] = useState('');
  const [stage, setStage] = useState('identified');
  const [nextAction, setNextAction] = useState('');
  const [nextActionDate, setNextActionDate] = useState('');
  const [source, setSource] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setName(''); setCompany(''); setFirmType(''); setLinkedinUrl('');
      setEmail(''); setStage('identified'); setNextAction('');
      setNextActionDate(''); setSource(''); setNotes(''); setError(null);
    }
  }, [open]);

  async function submit() {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/crm/outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          company_name: company.trim() || null,
          firm_type: firmType || null,
          contact_linkedin_url: linkedinUrl.trim() || null,
          contact_email: email.trim() || null,
          stage,
          next_action: nextAction.trim() || null,
          next_action_date: nextActionDate || null,
          source: source || null,
          notes: notes.trim() || null,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      onCreated();
      onClose();
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open} onClose={onClose} title="New prospect" size="md"
      footer={
        <>
          <button onClick={onClose} className="px-3 py-1.5 text-[12.5px] rounded-md border border-border hover:bg-surface-alt">Cancel</button>
          <button onClick={submit} disabled={busy || !name.trim()} className="px-3 py-1.5 text-[12.5px] rounded-md bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50">
            {busy ? 'Creating…' : 'Create'}
          </button>
        </>
      }
    >
      <div className="space-y-3 text-[12.5px]">
        <label className="block">
          <span className="text-ink-muted">Name</span>
          <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Full name" className="mt-1 w-full px-2 py-1.5 border border-border rounded-md bg-surface" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label>
            <span className="text-ink-muted">Company</span>
            <input value={company} onChange={e => setCompany(e.target.value)} className="mt-1 w-full px-2 py-1.5 border border-border rounded-md bg-surface" />
          </label>
          <label>
            <span className="text-ink-muted">Firm type</span>
            <select value={firmType} onChange={e => setFirmType(e.target.value)} className="mt-1 w-full px-2 py-1.5 border border-border rounded-md bg-surface">
              {FIRM_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label>
            <span className="text-ink-muted">LinkedIn URL</span>
            <input value={linkedinUrl} onChange={e => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/in/…" className="mt-1 w-full px-2 py-1.5 border border-border rounded-md bg-surface" />
          </label>
          <label>
            <span className="text-ink-muted">Email</span>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-1 w-full px-2 py-1.5 border border-border rounded-md bg-surface" />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label>
            <span className="text-ink-muted">Initial stage</span>
            <select value={stage} onChange={e => setStage(e.target.value)} className="mt-1 w-full px-2 py-1.5 border border-border rounded-md bg-surface">
              {STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </label>
          <label>
            <span className="text-ink-muted">Source</span>
            <select value={source} onChange={e => setSource(e.target.value)} className="mt-1 w-full px-2 py-1.5 border border-border rounded-md bg-surface">
              {SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label>
            <span className="text-ink-muted">Next action</span>
            <input value={nextAction} onChange={e => setNextAction(e.target.value)} placeholder="e.g. Send LinkedIn DM" className="mt-1 w-full px-2 py-1.5 border border-border rounded-md bg-surface" />
          </label>
          <label>
            <span className="text-ink-muted">Next action date</span>
            <input type="date" value={nextActionDate} onChange={e => setNextActionDate(e.target.value)} className="mt-1 w-full px-2 py-1.5 border border-border rounded-md bg-surface" />
          </label>
        </div>
        <label className="block">
          <span className="text-ink-muted">Notes</span>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="mt-1 w-full px-2 py-1.5 border border-border rounded-md bg-surface" />
        </label>
        {error && <div className="rounded-md border border-danger-400 bg-danger-50/50 p-2 text-[12px] text-danger-800">{error}</div>}
      </div>
    </Modal>
  );
}
