'use client';

// ════════════════════════════════════════════════════════════════════════
// RetainerLedger — panel shown on a company detail page. Aggregates:
//   - Current balance (topups − drawdowns from invoices)
//   - Top-up history (immutable ledger rows)
//   - Drawdowns (invoices that ate into the retainer)
// Plus a "Record top-up" modal for logging new cash received.
//
// Negative top-ups are allowed (adjustments / refunds) and rendered
// with a minus sign and danger tint.
// ════════════════════════════════════════════════════════════════════════

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { PlusIcon, Trash2Icon, WalletIcon } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/Toaster';
import { formatEur, formatDate } from '@/lib/crm-types';

interface Topup {
  id: string;
  amount_eur: string | number;
  topup_date: string;
  reference: string | null;
  notes: string | null;
  created_at: string;
  created_by: string | null;
  matter_id?: string | null;
}

interface Drawdown {
  id: string;
  invoice_number: string;
  issue_date: string | null;
  drawn_from_retainer_eur: string | number;
  matter_id?: string | null;
}

interface LedgerData {
  balance_eur: number;
  total_topped_up_eur: number;
  total_drawn_down_eur: number;
  topups: Topup[];
  drawdowns: Drawdown[];
}

export function RetainerLedger({ companyId, companyName }: { companyId: string; companyName: string }) {
  const toast = useToast();
  const [data, setData] = useState<LedgerData | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/crm/companies/${companyId}/retainers`, { cache: 'no-store' })
      .then(r => r.json()).then(setData).catch(() => setData(null));
  }, [companyId]);
  useEffect(() => { load(); }, [load]);

  async function removeTopup(id: string) {
    if (!confirm('Remove this top-up entry? Balance will adjust and audit row is retained.')) return;
    const res = await fetch(`/api/crm/retainers/${id}`, { method: 'DELETE' });
    if (!res.ok) { toast.error('Remove failed'); return; }
    toast.success('Top-up removed');
    load();
  }

  if (!data) {
    return <div className="text-sm text-ink-muted italic px-3 py-4">Loading retainer ledger…</div>;
  }

  const { balance_eur, total_topped_up_eur, total_drawn_down_eur, topups, drawdowns } = data;
  const hasAnyActivity = topups.length > 0 || drawdowns.length > 0;
  const balanceTone =
    balance_eur < 0   ? 'text-danger-700' :
    balance_eur === 0 ? 'text-ink-muted'  :
                        'text-emerald-700';

  return (
    <div className="border border-border rounded-lg bg-white mb-5 overflow-hidden">
      <div className="px-3 py-2 flex items-center justify-between border-b border-border bg-surface-alt/40">
        <div className="flex items-center gap-2">
          <WalletIcon size={14} className="text-ink-muted" />
          <span className="text-sm uppercase tracking-wide font-semibold text-ink-muted">Retainer ledger</span>
        </div>
        <Button variant="primary" size="sm" icon={<PlusIcon size={12} />} onClick={() => setAddOpen(true)}>
          Record top-up
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-0 border-b border-border">
        <Kpi label="Balance"      value={formatEur(balance_eur)}          tone={balanceTone} />
        <Kpi label="Topped up"    value={formatEur(total_topped_up_eur)}  tone="text-ink" />
        <Kpi label="Drawn down"   value={formatEur(total_drawn_down_eur)} tone="text-ink" />
      </div>

      {!hasAnyActivity && (
        <p className="p-3 text-sm text-ink-muted italic">
          No retainer activity yet for {companyName}. Record a top-up when funds arrive.
        </p>
      )}

      {topups.length > 0 && (
        <div className="p-3 border-b border-border">
          <div className="text-2xs uppercase tracking-wide font-semibold text-ink-muted mb-1.5">Top-ups ({topups.length})</div>
          <ul className="space-y-1">
            {topups.map(t => {
              const amt = Number(t.amount_eur);
              const isNegative = amt < 0;
              return (
                <li key={t.id} className="flex items-center gap-2 text-sm border border-border rounded px-2 py-1.5">
                  <span className="tabular-nums text-ink-muted shrink-0 w-[80px]">{formatDate(t.topup_date)}</span>
                  <span className={`tabular-nums font-medium shrink-0 w-[90px] ${isNegative ? 'text-danger-700' : 'text-emerald-700'}`}>
                    {isNegative ? '−' : '+'}{formatEur(Math.abs(amt))}
                  </span>
                  <span className="text-ink-muted font-mono text-xs shrink-0">{t.reference ?? '—'}</span>
                  <span className="text-ink-muted flex-1 truncate text-xs" title={t.notes ?? ''}>{t.notes ?? ''}</span>
                  <button onClick={() => removeTopup(t.id)} className="text-danger-600 hover:text-danger-800 shrink-0" title="Remove">
                    <Trash2Icon size={11} />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {drawdowns.length > 0 && (
        <div className="p-3">
          <div className="text-2xs uppercase tracking-wide font-semibold text-ink-muted mb-1.5">Drawdowns ({drawdowns.length})</div>
          <ul className="space-y-1">
            {drawdowns.map(d => {
              const amt = Number(d.drawn_from_retainer_eur);
              return (
                <li key={d.id} className="flex items-center gap-2 text-sm border border-border rounded px-2 py-1.5">
                  <span className="tabular-nums text-ink-muted shrink-0 w-[80px]">{formatDate(d.issue_date)}</span>
                  <span className="tabular-nums font-medium shrink-0 w-[90px] text-danger-700">−{formatEur(amt)}</span>
                  <Link href={`/crm/billing/${d.id}`} className="font-mono text-xs text-brand-700 hover:underline">
                    {d.invoice_number}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {addOpen && (
        <AddTopupModal
          companyId={companyId}
          onClose={() => setAddOpen(false)}
          onSaved={() => { setAddOpen(false); load(); }}
        />
      )}
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="px-3 py-2 border-r border-border last:border-r-0">
      <div className="text-2xs uppercase tracking-wide font-semibold text-ink-muted">{label}</div>
      <div className={`text-base font-semibold tabular-nums ${tone}`}>{value}</div>
    </div>
  );
}

function AddTopupModal({
  companyId, onClose, onSaved,
}: {
  companyId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    const n = Number(amount);
    if (!Number.isFinite(n) || n === 0) {
      toast.error('Amount must be a non-zero number (negative = adjustment/refund)');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/crm/companies/${companyId}/retainers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount_eur: n, topup_date: date,
          reference: reference || null,
          notes: notes || null,
        }),
      });
      if (!res.ok) { toast.error('Record top-up failed'); return; }
      toast.success(n > 0 ? `€${n.toFixed(2)} topped up` : `€${Math.abs(n).toFixed(2)} adjustment`);
      onSaved();
    } finally { setSaving(false); }
  }

  return (
    <Modal
      open={true}
      onClose={saving ? () => {} : onClose}
      title="Record retainer top-up"
      size="md"
      footer={
        <div className="flex items-center gap-2 justify-end">
          <button onClick={onClose} disabled={saving} className="h-8 px-3 rounded-md border border-border text-sm text-ink-soft hover:bg-surface-alt disabled:opacity-40">Cancel</button>
          <Button variant="primary" size="sm" onClick={submit} loading={saving}>Record</Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs uppercase tracking-wide font-semibold text-ink-muted mb-1">Amount (€) *</label>
          <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="10000" className="w-full h-9 px-2.5 text-sm border border-border rounded-md tabular-nums" />
          <p className="mt-1 text-2xs text-ink-muted">Negative = adjustment or refund.</p>
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wide font-semibold text-ink-muted mb-1">Received on *</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full h-9 px-2.5 text-sm border border-border rounded-md" />
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs uppercase tracking-wide font-semibold text-ink-muted mb-1">Bank reference</label>
          <input value={reference} onChange={e => setReference(e.target.value)} placeholder="Bank statement ref" className="w-full h-9 px-2.5 text-sm border border-border rounded-md font-mono" />
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs uppercase tracking-wide font-semibold text-ink-muted mb-1">Notes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full px-2.5 py-2 text-sm border border-border rounded-md resize-y" />
        </div>
      </div>
    </Modal>
  );
}
