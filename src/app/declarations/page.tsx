'use client';

import { useEffect, useState, Suspense, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { PlusIcon, ArrowRightIcon, FileTextIcon } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Field, Input, Select } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageSkeleton } from '@/components/ui/Skeleton';

interface Entity { id: string; name: string; regime: string; frequency: string; has_outgoing?: number | boolean }
interface Declaration { id: string; entity_id: string; entity_name: string; year: number; period: string; status: string; created_at: string }

export default function DeclarationsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <DeclarationsContent />
    </Suspense>
  );
}

function DeclarationsContent() {
  const searchParams = useSearchParams();
  const entityId = searchParams.get('entity_id');

  const [entities, setEntities] = useState<Entity[] | null>(null);
  const [declarations, setDeclarations] = useState<Declaration[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ entity_id: entityId || '', year: new Date().getFullYear(), period: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/entities').then(r => r.json()).then(setEntities);
    const url = entityId ? `/api/declarations?entity_id=${entityId}` : '/api/declarations';
    fetch(url).then(r => r.json()).then(setDeclarations);
  }, [entityId]);

  // Smart default: when entity selected, prefill the next unfiled period
  const periodsForEntity = (id: string): string[] => {
    const entity = entities?.find(e => e.id === id);
    if (!entity) return ['Y1'];
    if (entity.frequency === 'annual') return ['Y1'];
    if (entity.frequency === 'quarterly') return ['Q1', 'Q2', 'Q3', 'Q4'];
    return ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
  };

  // Precompute next suggested (year, period) for selected entity
  const nextSuggestion = useMemo(() => {
    if (!form.entity_id || !declarations) return null;
    const entity = entities?.find(e => e.id === form.entity_id);
    if (!entity) return null;
    const taken = new Set(declarations.filter(d => d.entity_id === form.entity_id).map(d => `${d.year}::${d.period}`));
    const now = new Date();
    const currentYear = now.getUTCFullYear();
    // Iterate recent past periods looking for the first unfiled one
    for (let yOffset = 0; yOffset < 3; yOffset++) {
      const y = currentYear - yOffset;
      const periods = periodsForEntity(entity.id);
      for (let i = periods.length - 1; i >= 0; i--) {
        const p = periods[i];
        if (!taken.has(`${y}::${p}`)) return { year: y, period: p };
      }
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.entity_id, entities, declarations]);

  useEffect(() => {
    if (nextSuggestion && !form.period) {
      setForm(f => ({ ...f, year: nextSuggestion.year, period: nextSuggestion.period }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextSuggestion]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const res = await fetch('/api/declarations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (!res.ok) { setError((await res.json()).error || 'Failed'); return; }
    const d = await res.json();
    window.location.href = `/declarations/${d.id}`;
  }

  if (!entities || !declarations) return <PageSkeleton />;

  const selectedEntity = entities.find(e => e.id === form.entity_id);

  return (
    <div>
      <PageHeader
        title={
          <>
            Declarations
            {entityId && selectedEntity && (
              <span className="text-[16px] text-ink-muted font-normal ml-3">for {selectedEntity.name}</span>
            )}
          </>
        }
        subtitle="Each declaration follows the lifecycle: uploaded → extracted → classified → reviewed → approved → filed → paid."
        actions={
          <Button variant="primary" icon={<PlusIcon size={14} />} onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : 'New declaration'}
          </Button>
        }
      />

      {showForm && (
        <Card className="mb-6 animate-fadeIn">
          <CardHeader title="New declaration" subtitle={nextSuggestion ? `Suggested next unfiled period: ${nextSuggestion.year} ${nextSuggestion.period}` : undefined} />
          <CardBody>
            <form onSubmit={handleCreate}>
              {error && <div className="text-danger-700 text-[12.5px] mb-3 bg-danger-50 border border-[#F4B9B7] rounded-md px-3 py-2">{error}</div>}
              <div className="grid grid-cols-3 gap-3">
                <Field label="Entity *">
                  <Select required value={form.entity_id}
                    onChange={e => setForm({ ...form, entity_id: e.target.value, period: '' })}>
                    <option value="">Select entity…</option>
                    {entities.map(e => <option key={e.id} value={e.id}>{e.name} ({e.regime})</option>)}
                  </Select>
                </Field>
                <Field label="Year *">
                  <Select required value={form.year} onChange={e => setForm({ ...form, year: parseInt(e.target.value) })}>
                    {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                  </Select>
                </Field>
                <Field label="Period *">
                  <Select required value={form.period} onChange={e => setForm({ ...form, period: e.target.value })}>
                    <option value="">Select period…</option>
                    {form.entity_id && periodsForEntity(form.entity_id).map(p => <option key={p} value={p}>{p}</option>)}
                  </Select>
                </Field>
              </div>
              <div className="mt-4">
                <Button type="submit" variant="primary">Create declaration</Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      {declarations.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FileTextIcon size={22} />}
            title="No declarations yet"
            description={entities.length === 0
              ? 'Create an entity first, then start your first declaration.'
              : 'Click "New declaration" to start your first one.'}
            action={entities.length === 0 ? (
              <Link href="/entities"><Button variant="primary">Create an entity</Button></Link>
            ) : undefined}
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-[12.5px]">
            <thead className="bg-surface-alt border-b border-divider text-ink-muted">
              <tr>
                <Th>Entity</Th>
                <Th>Year</Th>
                <Th>Period</Th>
                <Th>Status</Th>
                <Th>Created</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {declarations.map(d => (
                <tr key={d.id} className="border-b border-divider last:border-0 hover:bg-surface-alt/60 transition-colors duration-150">
                  <td className="px-4 py-3 font-medium text-ink">{d.entity_name}</td>
                  <td className="px-4 py-3 text-ink-soft tabular-nums">{d.year}</td>
                  <td className="px-4 py-3 text-ink-soft">{d.period}</td>
                  <td className="px-4 py-3"><StatusPill status={d.status} /></td>
                  <td className="px-4 py-3 text-ink-muted text-[11.5px]">{new Date(d.created_at).toLocaleDateString('en-GB')}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/declarations/${d.id}`} className="inline-flex items-center text-brand-600 hover:text-brand-700 text-[11.5px] font-medium transition-colors gap-1">
                      Open <ArrowRightIcon size={12} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="px-4 py-2.5 text-left font-medium text-[10.5px] uppercase tracking-[0.06em]">{children}</th>;
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { tone: 'neutral' | 'info' | 'violet' | 'amber' | 'warning' | 'success' | 'teal'; label: string }> = {
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
