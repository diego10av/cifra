'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageSkeleton } from '@/components/ui/Skeleton';
import {
  LABELS_CLASSIFICATION, LABELS_INDUSTRY, LABELS_SIZE,
  LABELS_STAGE, LABELS_MATTER_STATUS, LABELS_INVOICE_STATUS,
  formatEur, formatDate,
} from '@/lib/crm-types';

interface CompanyDetail {
  company: Record<string, unknown>;
  contacts: Array<{ id: string; full_name: string; email: string | null; job_title: string | null; role: string; is_primary: boolean }>;
  opportunities: Array<{ id: string; name: string; stage: string; estimated_value_eur: number | null; probability_pct: number | null; weighted_value_eur: number | null; estimated_close_date: string | null }>;
  matters: Array<{ id: string; matter_reference: string; title: string; status: string; practice_areas: string[]; opening_date: string | null; closing_date: string | null }>;
  invoices: Array<{ id: string; invoice_number: string; issue_date: string | null; due_date: string | null; amount_incl_vat: number; outstanding: number; status: string }>;
}

export default function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<CompanyDetail | null>(null);

  useEffect(() => {
    fetch(`/api/crm/companies/${id}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(setData)
      .catch(() => setData(null));
  }, [id]);

  if (!data) return <PageSkeleton />;
  const c = data.company as Record<string, string | number | string[] | null>;

  return (
    <div>
      <div className="text-[11.5px] text-ink-muted mb-2">
        <Link href="/crm/companies" className="hover:underline">← All companies</Link>
      </div>
      <PageHeader
        title={String(c.company_name ?? '(unnamed)')}
        subtitle={`${c.classification ? LABELS_CLASSIFICATION[c.classification as keyof typeof LABELS_CLASSIFICATION] : ''}${c.country ? ` · ${c.country}` : ''}`}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
        <Card title="Industry">{c.industry ? LABELS_INDUSTRY[c.industry as keyof typeof LABELS_INDUSTRY] : '—'}</Card>
        <Card title="Size">{c.size ? LABELS_SIZE[c.size as keyof typeof LABELS_SIZE] : '—'}</Card>
        <Card title="Linked tax entity">{c.entity_id ? <Link href={`/entities/${String(c.entity_id)}`} className="text-brand-700 hover:underline">View in Tax module →</Link> : '—'}</Card>
      </div>

      {c.notes && (
        <div className="mb-5 p-3 bg-surface-alt border border-border rounded text-[12.5px] whitespace-pre-wrap">{String(c.notes)}</div>
      )}

      <Section title={`Contacts (${data.contacts.length})`}>
        <Table
          headers={['Name', 'Role', 'Email', 'Job title']}
          rows={data.contacts.map(x => [
            <Link key={x.id} href={`/crm/contacts/${x.id}`} className="text-brand-700 hover:underline">{x.full_name}</Link>,
            x.is_primary ? `${x.role} · primary` : x.role,
            x.email ?? '—',
            x.job_title ?? '—',
          ])}
        />
      </Section>

      <Section title={`Opportunities (${data.opportunities.length})`}>
        <Table
          headers={['Name', 'Stage', 'Value', 'Probability', 'Weighted', 'Close date']}
          rows={data.opportunities.map(x => [
            <Link key={x.id} href={`/crm/opportunities/${x.id}`} className="text-brand-700 hover:underline">{x.name}</Link>,
            LABELS_STAGE[x.stage as keyof typeof LABELS_STAGE] ?? x.stage,
            formatEur(x.estimated_value_eur),
            x.probability_pct !== null ? `${x.probability_pct}%` : '—',
            formatEur(x.weighted_value_eur),
            formatDate(x.estimated_close_date),
          ])}
        />
      </Section>

      <Section title={`Matters (${data.matters.length})`}>
        <Table
          headers={['Reference', 'Title', 'Status', 'Practice', 'Opened', 'Closed']}
          rows={data.matters.map(x => [
            <Link key={x.id} href={`/crm/matters/${x.id}`} className="text-brand-700 hover:underline">{x.matter_reference}</Link>,
            x.title,
            LABELS_MATTER_STATUS[x.status as keyof typeof LABELS_MATTER_STATUS] ?? x.status,
            (x.practice_areas ?? []).join(', '),
            formatDate(x.opening_date),
            formatDate(x.closing_date),
          ])}
        />
      </Section>

      <Section title={`Invoices (${data.invoices.length})`}>
        <Table
          headers={['Number', 'Issue', 'Due', 'Amount', 'Outstanding', 'Status']}
          rows={data.invoices.map(x => [
            x.invoice_number,
            formatDate(x.issue_date),
            formatDate(x.due_date),
            formatEur(x.amount_incl_vat),
            formatEur(x.outstanding),
            LABELS_INVOICE_STATUS[x.status as keyof typeof LABELS_INVOICE_STATUS] ?? x.status,
          ])}
        />
      </Section>
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h3 className="text-[12px] uppercase tracking-wide font-semibold text-ink-muted mb-2">{title}</h3>
      {children}
    </div>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  if (rows.length === 0) return <div className="text-[12px] text-ink-muted italic px-3 py-2">None</div>;
  return (
    <div className="border border-border rounded-md overflow-hidden bg-white">
      <table className="w-full text-[12px]">
        <thead className="bg-surface-alt text-ink-muted">
          <tr>{headers.map((h, i) => <th key={i} className="text-left px-3 py-1.5 font-medium">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-border">{r.map((cell, j) => <td key={j} className="px-3 py-1.5">{cell}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
