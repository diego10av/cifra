'use client';

// ════════════════════════════════════════════════════════════════════════
// /crm/settings/firm — Firm identity editor.
//
// Drives the letterhead on every invoice PDF. Fields grouped into:
//   - Identity         (name, VAT, matricule, RCS)
//   - Address          (multi-line; one line per row)
//   - Contact          (email, phone, website)
//   - Bank             (name, IBAN, BIC)
//   - Invoice defaults (payment terms, footer text)
//
// Autosave on blur is intentionally NOT used here — banking details
// are high-blast-radius, so we gate changes behind an explicit "Save"
// button with toast confirmation.
// ════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/Toaster';
import type { FirmSettings } from '@/lib/crm-firm-settings';

export default function FirmSettingsPage() {
  const toast = useToast();
  const [settings, setSettings] = useState<FirmSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/crm/firm-settings', { cache: 'no-store' })
      .then(r => r.json())
      .then(setSettings)
      .catch(() => setSettings(null));
  }, []);

  if (!settings) {
    return <div className="text-[12px] text-ink-muted italic px-3 py-6">Loading settings…</div>;
  }

  function set<K extends keyof FirmSettings>(key: K, value: FirmSettings[K]) {
    setSettings(s => (s ? { ...s, [key]: value } : s));
  }

  async function save() {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch('/api/crm/firm-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (!res.ok) {
        toast.error('Save failed');
        return;
      }
      const body = await res.json();
      if (Array.isArray(body.changed) && body.changed.length > 0) {
        toast.success(`Saved ${body.changed.length} field${body.changed.length === 1 ? '' : 's'}`);
      } else {
        toast.info('No changes to save');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-[760px]">
      <div className="text-[11.5px] text-ink-muted mb-2">
        <Link href="/crm/settings" className="hover:underline">← Settings</Link>
      </div>
      <PageHeader
        title="Firm identity"
        subtitle="Used on invoice PDFs and future engagement letters"
        actions={<Button variant="primary" size="sm" onClick={save} loading={saving}>Save changes</Button>}
      />

      <Section title="Identity">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Firm name *">
            <input value={settings.firm_name ?? ''} onChange={e => set('firm_name', e.target.value)} className="w-full h-9 px-2.5 text-[13px] border border-border rounded-md" />
          </Field>
          <Field label="VAT number">
            <input value={settings.firm_vat_number ?? ''} onChange={e => set('firm_vat_number', e.target.value || null)} placeholder="LU12345678" className="w-full h-9 px-2.5 text-[13px] border border-border rounded-md font-mono" />
          </Field>
          <Field label="Matricule (LU)">
            <input value={settings.firm_matricule ?? ''} onChange={e => set('firm_matricule', e.target.value || null)} placeholder="20232456346" className="w-full h-9 px-2.5 text-[13px] border border-border rounded-md font-mono" />
          </Field>
          <Field label="RCS number">
            <input value={settings.firm_rcs_number ?? ''} onChange={e => set('firm_rcs_number', e.target.value || null)} placeholder="B123456" className="w-full h-9 px-2.5 text-[13px] border border-border rounded-md font-mono" />
          </Field>
        </div>
      </Section>

      <Section title="Address">
        <Field label="Address lines (one per row)">
          <textarea
            value={(settings.firm_address_lines ?? []).join('\n')}
            onChange={e => set('firm_address_lines', e.target.value.split(/\n/).map(l => l.trim()).filter(Boolean))}
            rows={4}
            placeholder={'12 rue du Fossé\nL-1536 Luxembourg\nGrand Duchy of Luxembourg'}
            className="w-full px-2.5 py-2 text-[13px] border border-border rounded-md resize-y"
          />
        </Field>
      </Section>

      <Section title="Contact">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field label="Email">
            <input type="email" value={settings.firm_email ?? ''} onChange={e => set('firm_email', e.target.value || null)} placeholder="hello@yourfirm.lu" className="w-full h-9 px-2.5 text-[13px] border border-border rounded-md" />
          </Field>
          <Field label="Phone">
            <input value={settings.firm_phone ?? ''} onChange={e => set('firm_phone', e.target.value || null)} placeholder="+352 12 34 56" className="w-full h-9 px-2.5 text-[13px] border border-border rounded-md" />
          </Field>
          <Field label="Website">
            <input type="url" value={settings.firm_website ?? ''} onChange={e => set('firm_website', e.target.value || null)} placeholder="https://yourfirm.lu" className="w-full h-9 px-2.5 text-[13px] border border-border rounded-md" />
          </Field>
        </div>
      </Section>

      <Section title="Bank">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field label="Bank name">
            <input value={settings.bank_name ?? ''} onChange={e => set('bank_name', e.target.value || null)} placeholder="BGL BNP Paribas" className="w-full h-9 px-2.5 text-[13px] border border-border rounded-md" />
          </Field>
          <Field label="IBAN">
            <input value={settings.bank_iban ?? ''} onChange={e => set('bank_iban', e.target.value || null)} placeholder="LU00 0000 0000 0000 0000" className="w-full h-9 px-2.5 text-[13px] border border-border rounded-md font-mono" />
          </Field>
          <Field label="BIC">
            <input value={settings.bank_bic ?? ''} onChange={e => set('bank_bic', e.target.value || null)} placeholder="BGLLLULL" className="w-full h-9 px-2.5 text-[13px] border border-border rounded-md font-mono" />
          </Field>
        </div>
        <p className="mt-2 text-[10.5px] text-ink-muted italic">
          Appears in the &ldquo;Payment instructions&rdquo; block of every invoice PDF. Double-check before saving — payment typos
          cost real money.
        </p>
      </Section>

      <Section title="Invoice defaults">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Payment terms (days from issue)">
            <input
              type="number"
              value={settings.payment_terms_days}
              onChange={e => set('payment_terms_days', Number(e.target.value) || 30)}
              min={1}
              max={180}
              className="w-full h-9 px-2.5 text-[13px] border border-border rounded-md tabular-nums"
            />
          </Field>
          <Field label="Approval threshold (€) — blank = no approval required">
            <input
              type="number"
              value={settings.require_approval_above_eur ?? ''}
              onChange={e => set('require_approval_above_eur', e.target.value === '' ? null : Number(e.target.value))}
              min={0}
              placeholder="e.g. 10000"
              className="w-full h-9 px-2.5 text-[13px] border border-border rounded-md tabular-nums"
            />
          </Field>
          <div className="md:col-span-2">
            <p className="text-[10.5px] text-ink-muted italic">
              When set, invoices above this amount require an explicit Approve click before they can transition from draft to sent/paid.
              Useful for two-person control on large invoices. Leave blank to disable the gate entirely.
            </p>
          </div>
          <div className="md:col-span-2">
            <Field label="Footer text (legal boilerplate)">
              <textarea
                value={settings.footer_text ?? ''}
                onChange={e => set('footer_text', e.target.value || null)}
                rows={3}
                placeholder="Invoices are payable within the agreed terms. Late payment interest accrues at the statutory rate. Any dispute must be raised within 8 days of receipt."
                className="w-full px-2.5 py-2 text-[13px] border border-border rounded-md resize-y"
              />
            </Field>
          </div>
        </div>
      </Section>

      <div className="flex justify-end mt-4 pt-4 border-t border-border">
        <Button variant="primary" size="sm" onClick={save} loading={saving}>Save changes</Button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-5 p-4 border border-border rounded-md bg-white">
      <h3 className="text-[12px] uppercase tracking-wide font-semibold text-ink-muted mb-3">{title}</h3>
      {children}
    </section>
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
