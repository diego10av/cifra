'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PlusIcon, UsersIcon, SparklesIcon, AlertTriangleIcon, ClockIcon } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Stat } from '@/components/ui/Stat';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageSkeleton } from '@/components/ui/Skeleton';

interface Entity { id: string; name: string; client_name: string | null; regime: string; frequency: string }
interface Declaration {
  id: string; entity_id: string; entity_name: string;
  year: number; period: string; status: string;
  vat_due: number | null; created_at: string;
}
interface DeadlineRow {
  entity_id: string; due_date: string; days_until: number;
  is_overdue: boolean; bucket: string;
  declaration_id: string | null; declaration_status: string;
}

export default function Home() {
  const [entities, setEntities] = useState<Entity[] | null>(null);
  const [declarations, setDeclarations] = useState<Declaration[] | null>(null);
  const [deadlines, setDeadlines] = useState<DeadlineRow[] | null>(null);

  useEffect(() => {
    fetch('/api/entities').then(r => r.json()).then(setEntities);
    fetch('/api/declarations').then(r => r.json()).then(setDeclarations);
    fetch('/api/deadlines').then(r => r.json()).then(setDeadlines);
  }, []);

  if (!entities || !declarations || !deadlines) return <PageSkeleton />;

  const inReview = declarations.filter(d => d.status === 'review').length;
  const overdue = deadlines.filter(d => d.is_overdue).length;
  const dueIn7 = deadlines.filter(d => d.bucket === 'urgent').length;

  const rows = entities.map(e => {
    const lastDecl = declarations
      .filter(d => d.entity_id === e.id)
      .sort((a, b) => (b.year - a.year) || b.period.localeCompare(a.period))[0];
    const dl = deadlines.find(d => d.entity_id === e.id);
    return { entity: e, decl: lastDecl, deadline: dl };
  }).sort((a, b) => (a.deadline?.days_until ?? 9999) - (b.deadline?.days_until ?? 9999));

  return (
    <div>
      <PageHeader
        title="Overview"
        subtitle="Every entity and its next filing milestone, at a glance."
        actions={
          <>
            <Link href="/entities">
              <Button variant="secondary" icon={<UsersIcon size={14} />}>Entities</Button>
            </Link>
            <Link href="/declarations">
              <Button variant="primary" icon={<PlusIcon size={14} />}>New declaration</Button>
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-4 gap-3 mb-6">
        <Stat label="Entities" value={entities.length} />
        <Stat label="In review" value={inReview} tone={inReview > 0 ? 'warning' : 'muted'} />
        <Stat label="Due in 7 days" value={dueIn7} tone={dueIn7 > 0 ? 'warning' : 'muted'} />
        <Stat label="Overdue" value={overdue} tone={overdue > 0 ? 'danger' : 'muted'} />
      </div>

      {entities.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl">
          <EmptyState
            icon={<SparklesIcon size={22} />}
            title="No entities yet"
            description="Create your first entity to start preparing VAT declarations. You can import a prior-year Excel to seed the precedents."
            action={<Link href="/entities"><Button variant="primary" icon={<PlusIcon size={14} />}>Create entity</Button></Link>}
          />
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-xs">
          <table className="w-full text-[12.5px]">
            <thead className="bg-surface-alt border-b border-divider text-ink-muted">
              <tr>
                <Th>Client / Entity</Th>
                <Th>Regime · Frequency</Th>
                <Th>Latest period</Th>
                <Th>Status</Th>
                <Th align="right">Due</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ entity: e, decl, deadline }) => (
                <tr key={e.id} className="border-b border-divider last:border-0 hover:bg-surface-alt/60 transition-colors duration-150">
                  <td className="px-4 py-3">
                    <Link href={`/entities/${e.id}`} className="group">
                      <div className="font-medium text-ink group-hover:text-brand-600 transition-colors">{e.name}</div>
                      {e.client_name && <div className="text-[11px] text-ink-muted mt-0.5">{e.client_name}</div>}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink-soft capitalize">{e.regime} · {e.frequency}</td>
                  <td className="px-4 py-3 text-ink-soft">
                    {decl ? `${decl.year} ${decl.period}` : <span className="text-ink-faint">—</span>}
                  </td>
                  <td className="px-4 py-3">{decl ? <StatusPill status={decl.status} /> : <StatusPill status="not_started" />}</td>
                  <td className="px-4 py-3 text-right">
                    {deadline ? <BucketBadge bucket={deadline.bucket} days={deadline.days_until} /> : <span className="text-ink-faint">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {decl ? (
                      <Link href={`/declarations/${decl.id}`} className="text-brand-600 hover:text-brand-700 text-[11.5px] font-medium transition-colors">Open</Link>
                    ) : (
                      <Link href={`/declarations?entity_id=${e.id}`} className="text-brand-600 hover:text-brand-700 text-[11.5px] font-medium transition-colors">Start</Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Th({ children, align = 'left' }: { children?: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th className={`px-4 py-2.5 font-medium text-[10.5px] uppercase tracking-[0.06em] ${align === 'right' ? 'text-right' : 'text-left'}`}>
      {children}
    </th>
  );
}

function BucketBadge({ bucket, days }: { bucket: string; days: number }) {
  if (bucket === 'overdue') return <Badge tone="danger" icon={<AlertTriangleIcon size={10} />}>{Math.abs(days)}d overdue</Badge>;
  if (bucket === 'urgent') return <Badge tone="warning" icon={<ClockIcon size={10} />}>{days}d</Badge>;
  if (bucket === 'soon') return <Badge tone="amber">{days}d</Badge>;
  if (bucket === 'comfortable') return <Badge tone="info">{days}d</Badge>;
  return <Badge tone="neutral">{days}d</Badge>;
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { tone: 'neutral' | 'info' | 'violet' | 'amber' | 'warning' | 'success' | 'teal' | 'brand'; label: string }> = {
    not_started: { tone: 'neutral', label: 'Not started' },
    created:     { tone: 'neutral', label: 'Created' },
    uploading:   { tone: 'info',    label: 'Uploading' },
    extracting:  { tone: 'violet',  label: 'Extracting' },
    classifying: { tone: 'amber',   label: 'Classifying' },
    review:      { tone: 'warning', label: 'Review' },
    approved:    { tone: 'success', label: 'Approved' },
    filed:       { tone: 'teal',    label: 'Filed' },
    paid:        { tone: 'success', label: 'Paid' },
  };
  const { tone, label } = map[status] || { tone: 'neutral' as const, label: status };
  return <Badge tone={tone}>{label}</Badge>;
}
