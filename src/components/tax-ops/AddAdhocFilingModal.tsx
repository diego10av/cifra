'use client';

// ════════════════════════════════════════════════════════════════════════
// AddAdhocFilingModal — stint 37.F.
//
// Create a one-off filing (VAT registration, deregistration, FCR) for
// an entity that doesn't have a recurring obligation. Two-step create:
// 1. POST /api/tax-ops/obligations (creates or reactivates)
// 2. POST /api/tax-ops/filings (creates the filing row with period_label)
// Entity pulled from /api/tax-ops/entities (client-side searchable).
// ════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/Toaster';
import { FILING_STATUSES, filingStatusLabel } from './FilingStatusBadge';

const TYPE_OPTIONS = [
  { value: 'vat_registration',           label: 'VAT registration' },
  { value: 'vat_deregistration',         label: 'VAT deregistration' },
  { value: 'functional_currency_request', label: 'Functional currency request' },
];

interface EntityOption {
  id: string;
  legal_name: string;
  group_name: string | null;
}

export function AddAdhocFilingModal({
  open, onClose, onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [entities, setEntities] = useState<EntityOption[]>([]);
  const [entityId, setEntityId] = useState('');
  const [taxType, setTaxType] = useState<string>('vat_registration');
  const [status, setStatus] = useState<string>('info_to_request');
  const [comments, setComments] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const toast = useToast();

  useEffect(() => {
    if (!open) return;
    fetch('/api/tax-ops/entities')
      .then(r => r.ok ? r.json() : { entities: [] })
      .then((body: { entities: EntityOption[] }) => setEntities(body.entities ?? []))
      .catch(() => setEntities([]));
  }, [open]);

  useEffect(() => {
    if (!open) {
      setEntityId(''); setTaxType('vat_registration');
      setStatus('info_to_request'); setComments('');
      setSearch(''); setError(null);
    }
  }, [open]);

  const filtered = entities.filter(e => {
    const q = search.toLowerCase();
    return !q
      || e.legal_name.toLowerCase().includes(q)
      || (e.group_name ?? '').toLowerCase().includes(q);
  }).slice(0, 20);

  async function submit() {
    if (!entityId || busy) return;
    setBusy(true);
    setError(null);
    try {
      // 1. Create obligation (adhoc pattern)
      const oRes = await fetch('/api/tax-ops/obligations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_id: entityId,
          tax_type: taxType,
          period_pattern: 'adhoc',
          service_kind: 'filing',
        }),
      });
      if (!oRes.ok) {
        const b = await oRes.json().catch(() => ({}));
        throw new Error(b?.error ?? `Obligation create failed (${oRes.status})`);
      }
      const { id: obligationId } = await oRes.json() as { id: string };

      // 2. Create the filing. Use year as period_label + unique suffix
      //    so multiple ad-hoc filings of the same type on the same entity
      //    don't collide on (obligation_id, period_label).
      const year = new Date().getFullYear();
      const suffix = `ADHOC-${Date.now().toString(36).slice(-5).toUpperCase()}`;
      const fRes = await fetch('/api/tax-ops/filings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          obligation_id: obligationId,
          period_label: `${year}-${suffix}`,
          period_year: year,
          status,
          comments: comments.trim() || null,
        }),
      });
      if (!fRes.ok) {
        const b = await fRes.json().catch(() => ({}));
        throw new Error(b?.error ?? `Filing create failed (${fRes.status})`);
      }

      toast.success('Ad-hoc filing created');
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
      open={open}
      onClose={onClose}
      title="New ad-hoc filing"
      subtitle="VAT registration / deregistration / functional currency request — one-off filings with no recurring cadence."
      size="md"
      footer={
        <>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-surface-alt"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy || !entityId}
            className="px-3 py-1.5 text-sm rounded-md bg-brand-500 hover:bg-brand-600 text-white disabled:opacity-50"
          >
            {busy ? 'Creating…' : 'Create filing'}
          </button>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        <label className="block">
          <span className="text-ink-muted">Entity</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or family…"
            className="mt-1 w-full px-2 py-1.5 border border-border rounded-md bg-surface"
          />
          <select
            size={Math.min(6, Math.max(3, filtered.length))}
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
            className="mt-1 w-full px-2 py-1 border border-border rounded-md bg-surface font-mono text-sm"
          >
            {filtered.length === 0 && <option value="" disabled>No matches</option>}
            {filtered.map(e => (
              <option key={e.id} value={e.id}>
                {e.legal_name}{e.group_name ? ` · ${e.group_name}` : ''}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label>
            <span className="text-ink-muted">Type</span>
            <select
              value={taxType}
              onChange={(e) => setTaxType(e.target.value)}
              className="mt-1 w-full px-2 py-1.5 border border-border rounded-md bg-surface"
            >
              {TYPE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </label>
          <label>
            <span className="text-ink-muted">Initial status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="mt-1 w-full px-2 py-1.5 border border-border rounded-md bg-surface"
            >
              {FILING_STATUSES.map(s => (
                <option key={s} value={s}>{filingStatusLabel(s)}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="block">
          <span className="text-ink-muted">Comments (optional)</span>
          <textarea
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            rows={3}
            placeholder="Context: why, who requested, any paperwork…"
            className="mt-1 w-full px-2 py-1.5 border border-border rounded-md bg-surface"
          />
        </label>
        {error && (
          <div className="rounded-md border border-danger-400 bg-danger-50/50 p-2 text-sm text-danger-800">
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
}
