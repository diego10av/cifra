'use client';

// ════════════════════════════════════════════════════════════════════════
// MatterDisbursements — out-of-pocket cost log on a matter. Court
// fees, translators, notary, expert witnesses, travel. Each entry
// has a category, amount, billable flag, optional receipt URL, and
// (when billed) the invoice it appears on.
//
// Appears as its own section on the matter detail page, between time
// tracking and docs/closing.
// ════════════════════════════════════════════════════════════════════════

import { useEffect, useState, useCallback } from 'react';
import { PlusIcon, Trash2Icon, ExternalLinkIcon } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/Toaster';
import { formatEur, formatDate } from '@/lib/crm-types';

interface Disbursement {
  id: string;
  disbursement_date: string;
  description: string;
  amount_eur: string | number;
  currency: string;
  billable: boolean;
  billed_on_invoice_id: string | null;
  billed_invoice_number: string | null;
  category: string | null;
  receipt_url: string | null;
  notes: string | null;
}

const CATEGORIES = [
  { value: 'court_fee',  label: 'Court fee' },
  { value: 'notary',     label: 'Notary' },
  { value: 'translator', label: 'Translator' },
  { value: 'expert',     label: 'Expert / advisor' },
  { value: 'travel',     label: 'Travel' },
  { value: 'filing',     label: 'Filing / registration' },
  { value: 'courier',    label: 'Courier / postage' },
  { value: 'other',      label: 'Other' },
];

export function MatterDisbursements({ matterId }: { matterId: string }) {
  const toast = useToast();
  const [rows, setRows] = useState<Disbursement[] | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/crm/matters/${matterId}/disbursements`, { cache: 'no-store' })
      .then(r => r.json()).then(setRows).catch(() => setRows([]));
  }, [matterId]);
  useEffect(() => { load(); }, [load]);

  async function removeRow(id: string) {
    if (!confirm('Remove this disbursement? Only possible if not yet billed.')) return;
    const res = await fetch(`/api/crm/disbursements/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err?.error?.message ?? 'Remove failed');
      return;
    }
    toast.success('Disbursement removed');
    load();
  }

  if (rows === null) {
    return <div className="text-[12px] text-ink-muted italic px-3 py-4">Loading disbursements…</div>;
  }

  const total = rows.reduce((s, r) => s + Number(r.amount_eur), 0);
  const billableUnbilled = rows
    .filter(r => r.billable && !r.billed_on_invoice_id)
    .reduce((s, r) => s + Number(r.amount_eur), 0);

  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[12px] uppercase tracking-wide font-semibold text-ink-muted">
          Disbursements ({rows.length})
        </h3>
        <Button variant="primary" size="sm" icon={<PlusIcon size={12} />} onClick={() => setAddOpen(true)}>
          Log disbursement
        </Button>
      </div>

      {rows.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-2">
          <Kpi label="Total" value={formatEur(total)} />
          <Kpi label="Billable · unbilled" value={formatEur(billableUnbilled)} tone={billableUnbilled > 0 ? 'text-amber-700' : undefined} />
          <Kpi label="Entries" value={String(rows.length)} />
        </div>
      )}

      {rows.length === 0 ? (
        <div className="text-[12px] text-ink-muted italic px-3 py-3 border border-border rounded-md bg-white">
          No disbursements logged. Court fees, notary, translator, and other out-of-pocket costs belong here so they&apos;re auto-included on the next client invoice.
        </div>
      ) : (
        <div className="border border-border rounded-md bg-white overflow-hidden">
          <table className="w-full text-[12px]">
            <thead className="bg-surface-alt text-ink-muted">
              <tr>
                <th className="text-left px-3 py-1.5 font-medium">Date</th>
                <th className="text-left px-3 py-1.5 font-medium">Category</th>
                <th className="text-left px-3 py-1.5 font-medium">Description</th>
                <th className="text-right px-3 py-1.5 font-medium">Amount</th>
                <th className="text-left px-3 py-1.5 font-medium">Billable</th>
                <th className="text-left px-3 py-1.5 font-medium">Billed on</th>
                <th className="px-3 py-1.5"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(d => (
                <tr key={d.id} className="border-t border-border">
                  <td className="px-3 py-1.5 tabular-nums">{formatDate(d.disbursement_date)}</td>
                  <td className="px-3 py-1.5 text-ink-muted">
                    {d.category ? (CATEGORIES.find(c => c.value === d.category)?.label ?? d.category) : '—'}
                  </td>
                  <td className="px-3 py-1.5">
                    <div className="truncate max-w-[260px]" title={d.description}>{d.description}</div>
                    {d.receipt_url && (
                      <a href={d.receipt_url} target="_blank" rel="noopener noreferrer" className="text-[10.5px] text-brand-700 hover:underline inline-flex items-center gap-0.5">
                        Receipt <ExternalLinkIcon size={8} />
                      </a>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums font-medium">
                    {d.currency !== 'EUR' ? `${d.currency} ${Number(d.amount_eur).toFixed(2)}` : formatEur(d.amount_eur)}
                  </td>
                  <td className="px-3 py-1.5 text-ink-muted">{d.billable ? '✓' : ''}</td>
                  <td className="px-3 py-1.5 text-ink-muted font-mono text-[11px]">
                    {d.billed_invoice_number ?? (d.billable ? 'Pending' : '—')}
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    {!d.billed_on_invoice_id && (
                      <button onClick={() => removeRow(d.id)} className="text-danger-600 hover:text-danger-800" title="Remove">
                        <Trash2Icon size={12} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {addOpen && (
        <AddDisbursementModal
          matterId={matterId}
          onClose={() => setAddOpen(false)}
          onSaved={() => { setAddOpen(false); load(); }}
        />
      )}
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="border border-border rounded-md bg-white px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide font-semibold text-ink-muted">{label}</div>
      <div className={`text-[14px] font-semibold tabular-nums ${tone ?? 'text-ink'}`}>{value}</div>
    </div>
  );
}

function AddDisbursementModal({
  matterId, onClose, onSaved,
}: {
  matterId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [billable, setBillable] = useState(true);
  const [currency, setCurrency] = useState('EUR');
  const [receiptUrl, setReceiptUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!description.trim()) { toast.error('Description required'); return; }
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) { toast.error('Amount must be > 0'); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/crm/matters/${matterId}/disbursements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          disbursement_date: date,
          description: description.trim(),
          amount_eur: n,
          currency,
          category: category || null,
          billable,
          receipt_url: receiptUrl || null,
          notes: notes || null,
        }),
      });
      if (!res.ok) { toast.error('Log disbursement failed'); return; }
      toast.success(`${formatEur(n)} logged`);
      onSaved();
    } finally { setSaving(false); }
  }

  return (
    <Modal
      open={true}
      onClose={saving ? () => {} : onClose}
      title="Log disbursement"
      size="md"
      footer={
        <div className="flex items-center gap-2 justify-end">
          <button onClick={onClose} disabled={saving} className="h-8 px-3 rounded-md border border-border text-[12.5px] text-ink-soft hover:bg-surface-alt disabled:opacity-40">Cancel</button>
          <Button variant="primary" size="sm" onClick={submit} loading={saving}>Log disbursement</Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Date *">
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full h-9 px-2.5 text-[13px] border border-border rounded-md" />
        </Field>
        <Field label="Category">
          <select value={category} onChange={e => setCategory(e.target.value)} className="w-full h-9 px-2.5 text-[13px] border border-border rounded-md bg-white">
            <option value="">—</option>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </Field>
        <div className="md:col-span-2">
          <Field label="Description *">
            <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Court filing fee — appeal" className="w-full h-9 px-2.5 text-[13px] border border-border rounded-md" />
          </Field>
        </div>
        <Field label="Amount *">
          <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="250.00" className="w-full h-9 px-2.5 text-[13px] border border-border rounded-md tabular-nums" />
        </Field>
        <Field label="Currency">
          <select value={currency} onChange={e => setCurrency(e.target.value)} className="w-full h-9 px-2.5 text-[13px] border border-border rounded-md bg-white">
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
            <option value="USD">USD</option>
            <option value="CHF">CHF</option>
          </select>
        </Field>
        <Field label="Billable">
          <label className="inline-flex items-center gap-2 h-9 text-[13px]">
            <input type="checkbox" checked={billable} onChange={e => setBillable(e.target.checked)} className="h-4 w-4 accent-brand-500" />
            <span className="text-ink-soft">Yes, charge to the client</span>
          </label>
        </Field>
        <Field label="Receipt URL">
          <input type="url" value={receiptUrl} onChange={e => setReceiptUrl(e.target.value)} placeholder="https://..." className="w-full h-9 px-2.5 text-[13px] border border-border rounded-md" />
        </Field>
        <div className="md:col-span-2">
          <Field label="Notes">
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full px-2.5 py-2 text-[13px] border border-border rounded-md resize-y" />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] uppercase tracking-wide font-semibold text-ink-muted mb-1">{label}</label>
      {children}
    </div>
  );
}
