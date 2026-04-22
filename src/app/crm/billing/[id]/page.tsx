'use client';

import { useEffect, useState, use, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PencilIcon, Trash2Icon, PlusIcon } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/Toaster';
import { CrmFormModal } from '@/components/crm/CrmFormModal';
import { INVOICE_FIELDS } from '@/components/crm/schemas';
import { LABELS_INVOICE_STATUS, formatEur, formatDate } from '@/lib/crm-types';

interface InvoiceDetail {
  invoice: Record<string, unknown> & {
    client_name?: string; client_id?: string;
    matter_reference?: string; matter_id?: string;
    primary_contact_name?: string;
  };
  payments: Array<{ id: string; amount: number; payment_date: string; payment_method: string | null; payment_reference: string | null; notes: string | null }>;
}

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const toast = useToast();
  const [data, setData] = useState<InvoiceDetail | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/crm/billing/${id}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(setData)
      .catch(() => setData(null));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function handleUpdate(values: Record<string, unknown>) {
    const res = await fetch(`/api/crm/billing/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message ?? `Update failed (${res.status})`);
    }
    const body = await res.json();
    if (Array.isArray(body.changed) && body.changed.length > 0) {
      toast.success(`Updated ${body.changed.length} field${body.changed.length === 1 ? '' : 's'}`);
    } else toast.info('No changes to save');
    await load();
  }

  async function handleDelete() {
    const number = String((data?.invoice as { invoice_number?: string })?.invoice_number ?? '?');
    if (!confirm(`Delete invoice ${number}?\n\nOnly draft / cancelled invoices can be deleted. Others must be cancelled first to preserve audit trail.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/crm/billing/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err?.error?.message ?? `Delete failed (${res.status})`);
        return;
      }
      toast.success('Invoice deleted');
      router.push('/crm/billing');
    } finally {
      setDeleting(false);
    }
  }

  async function handleRecordPayment(amount: string, date: string, method: string, ref: string) {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      toast.error('Amount must be a positive number');
      return;
    }
    if (!date) {
      toast.error('Payment date is required');
      return;
    }
    const res = await fetch(`/api/crm/billing/${id}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: n, payment_date: date,
        payment_method: method || null,
        payment_reference: ref || null,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err?.error?.message ?? `Payment record failed`);
      return;
    }
    const body = await res.json();
    toast.success(`Payment recorded · status: ${body.new_status}`);
    setPayOpen(false);
    await load();
  }

  async function handleDeletePayment(paymentId: string) {
    if (!confirm('Remove this payment? Invoice status will be recalculated.')) return;
    const res = await fetch(`/api/crm/billing/${id}/payments?payment_id=${paymentId}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err?.error?.message ?? `Delete failed`);
      return;
    }
    const body = await res.json();
    toast.success(`Payment removed · status: ${body.new_status}`);
    await load();
  }

  if (!data) return <PageSkeleton />;
  const i = data.invoice as Record<string, string | number | null> & {
    client_name?: string; client_id?: string;
    matter_reference?: string; matter_id?: string;
    primary_contact_name?: string;
  };

  return (
    <div>
      <div className="text-[11.5px] text-ink-muted mb-2">
        <Link href="/crm/billing" className="hover:underline">← All invoices</Link>
      </div>
      <PageHeader
        title={<span className="font-mono">{String(i.invoice_number)}</span>}
        subtitle={`${i.status ? LABELS_INVOICE_STATUS[i.status as keyof typeof LABELS_INVOICE_STATUS] : ''} · Issued ${formatDate(i.issue_date as string)} · Due ${formatDate(i.due_date as string)}`}
        actions={
          <>
            <Button variant="secondary" size="sm" icon={<PlusIcon size={13} />} onClick={() => setPayOpen(true)}>
              Record payment
            </Button>
            <Button variant="secondary" size="sm" icon={<PencilIcon size={13} />} onClick={() => setEditOpen(true)}>Edit</Button>
            <Button variant="ghost" size="sm" icon={<Trash2Icon size={13} />} onClick={handleDelete} loading={deleting}>Delete</Button>
          </>
        }
      />
      <CrmFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        mode="edit"
        title="Edit invoice"
        subtitle={String(i.invoice_number ?? '')}
        fields={INVOICE_FIELDS}
        initial={{
          invoice_number: i.invoice_number,
          status: i.status,
          issue_date: i.issue_date,
          due_date: i.due_date,
          currency: i.currency ?? 'EUR',
          amount_excl_vat: i.amount_excl_vat,
          vat_rate: i.vat_rate,
          amount_incl_vat: i.amount_incl_vat,
          payment_method: i.payment_method,
          payment_reference: i.payment_reference,
          notes: i.notes,
        }}
        onSave={handleUpdate}
      />
      <PaymentModal open={payOpen} onClose={() => setPayOpen(false)} onSave={handleRecordPayment} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Kpi label="Amount (incl. VAT)" value={formatEur(i.amount_incl_vat)} />
        <Kpi label="VAT" value={formatEur(i.vat_amount)} />
        <Kpi label="Paid" value={formatEur(i.amount_paid)} tone="success" />
        <Kpi label="Outstanding" value={formatEur((i as Record<string, number | null>).outstanding)} tone={Number((i as Record<string, number | null>).outstanding ?? 0) > 0 ? 'warning' : undefined} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
        <Card title="Client">
          {i.client_id ? <Link href={`/crm/companies/${i.client_id}`} className="text-brand-700 hover:underline">{i.client_name ?? '—'}</Link> : '—'}
        </Card>
        <Card title="Matter">
          {i.matter_id ? <Link href={`/crm/matters/${i.matter_id}`} className="text-brand-700 hover:underline font-mono">{i.matter_reference ?? '—'}</Link> : '—'}
        </Card>
        <Card title="Payment method">{String(i.payment_method ?? '—')}</Card>
      </div>

      {i.notes && (
        <div className="mb-5 p-3 bg-surface-alt border border-border rounded text-[12.5px] whitespace-pre-wrap">{String(i.notes)}</div>
      )}

      <div className="mb-5">
        <h3 className="text-[12px] uppercase tracking-wide font-semibold text-ink-muted mb-2">Payments ({data.payments.length})</h3>
        {data.payments.length === 0 ? (
          <div className="text-[12px] text-ink-muted italic px-3 py-2">No payments recorded yet.</div>
        ) : (
          <div className="border border-border rounded-md overflow-hidden bg-white">
            <table className="w-full text-[12px]">
              <thead className="bg-surface-alt text-ink-muted">
                <tr>
                  <th className="text-left px-3 py-1.5 font-medium">Date</th>
                  <th className="text-right px-3 py-1.5 font-medium">Amount</th>
                  <th className="text-left px-3 py-1.5 font-medium">Method</th>
                  <th className="text-left px-3 py-1.5 font-medium">Reference</th>
                  <th className="text-right px-3 py-1.5 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.payments.map(p => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="px-3 py-1.5 tabular-nums">{formatDate(p.payment_date)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{formatEur(p.amount)}</td>
                    <td className="px-3 py-1.5 text-ink-muted">{p.payment_method ?? '—'}</td>
                    <td className="px-3 py-1.5 text-ink-muted font-mono">{p.payment_reference ?? '—'}</td>
                    <td className="px-3 py-1.5 text-right">
                      <button onClick={() => handleDeletePayment(p.id)} className="text-danger-600 hover:text-danger-800 text-[11px]">
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: 'success' | 'warning' }) {
  const toneClass = tone === 'success' ? 'text-emerald-700' : tone === 'warning' ? 'text-amber-700' : 'text-ink';
  return (
    <div className="border border-border rounded-md bg-white px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide font-semibold text-ink-muted">{label}</div>
      <div className={`text-[16px] font-semibold tabular-nums ${toneClass}`}>{value}</div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-border rounded-md bg-white px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide font-semibold text-ink-muted mb-1">{title}</div>
      <div className="text-[13px]">{children}</div>
    </div>
  );
}

function PaymentModal({
  open, onClose, onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (amount: string, date: string, method: string, ref: string) => void | Promise<void>;
}) {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState('bank_transfer');
  const [ref, setRef] = useState('');

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record payment"
      size="md"
      footer={
        <div className="flex items-center gap-2 justify-end">
          <button onClick={onClose} className="h-8 px-3 rounded-md border border-border text-[12.5px] text-ink-soft hover:bg-surface-alt">Cancel</button>
          <Button variant="primary" size="sm" onClick={() => onSave(amount, date, method, ref)}>Record</Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] uppercase tracking-wide font-semibold text-ink-muted mb-1">Amount (€) *</label>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="5000" className="w-full h-9 px-2.5 text-[13px] border border-border rounded-md focus:outline-none focus:border-brand-500 tabular-nums" />
        </div>
        <div>
          <label className="block text-[11px] uppercase tracking-wide font-semibold text-ink-muted mb-1">Date *</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full h-9 px-2.5 text-[13px] border border-border rounded-md focus:outline-none focus:border-brand-500" />
        </div>
        <div>
          <label className="block text-[11px] uppercase tracking-wide font-semibold text-ink-muted mb-1">Method</label>
          <select value={method} onChange={e => setMethod(e.target.value)} className="w-full h-9 px-2.5 text-[13px] border border-border rounded-md bg-white">
            <option value="bank_transfer">Bank transfer</option>
            <option value="direct_debit">Direct debit</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className="block text-[11px] uppercase tracking-wide font-semibold text-ink-muted mb-1">Reference</label>
          <input value={ref} onChange={e => setRef(e.target.value)} placeholder="Bank statement ref" className="w-full h-9 px-2.5 text-[13px] border border-border rounded-md focus:outline-none focus:border-brand-500" />
        </div>
      </div>
    </Modal>
  );
}
