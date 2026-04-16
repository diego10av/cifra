'use client';

import { useEffect, useState, useRef } from 'react';

interface AEDComm {
  id: string;
  entity_id: string | null;
  entity_name: string | null;
  filename: string;
  file_size: number;
  type: string | null;
  amount: number | null;
  reference: string | null;
  deadline_date: string | null;
  urgency: string | null;
  summary: string | null;
  status: string;
  uploaded_at: string;
}

interface Entity {
  id: string;
  name: string;
}

export default function AEDLettersPage() {
  const [letters, setLetters] = useState<AEDComm[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [selectedEntity, setSelectedEntity] = useState('');
  const [uploading, setUploading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'open'>('all');
  const fileInput = useRef<HTMLInputElement>(null);

  function load() {
    fetch('/api/aed').then(r => r.json()).then(setLetters);
  }

  useEffect(() => {
    load();
    fetch('/api/entities').then(r => r.json()).then(setEntities);
  }, []);

  async function handleUpload(files: FileList | null) {
    if (!files || !files.length) return;
    setUploading(true);
    for (const f of Array.from(files)) {
      const form = new FormData();
      form.set('file', f);
      if (selectedEntity) form.set('entity_id', selectedEntity);
      await fetch('/api/aed/upload', { method: 'POST', body: form });
    }
    setUploading(false);
    load();
  }

  async function setStatus(id: string, status: string) {
    await fetch(`/api/aed/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    load();
  }

  async function openLetter(id: string) {
    const res = await fetch(`/api/aed/${id}?action=url`);
    const d = await res.json();
    if (d.url) window.open(d.url, '_blank', 'noopener');
  }

  const visible = statusFilter === 'open'
    ? letters.filter(l => l.status === 'received' || l.status === 'reviewed')
    : letters;

  const counts = {
    total: letters.length,
    high: letters.filter(l => l.urgency === 'high' && l.status !== 'archived').length,
    open: letters.filter(l => l.status === 'received' || l.status === 'reviewed').length,
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[20px] font-semibold tracking-tight">AED communications</h1>
          <p className="text-[12px] text-ink-muted mt-1">
            Letters received from the Luxembourg tax authority. Auto-classified by Claude on upload.
          </p>
        </div>
        <div className="flex gap-1">
          <FilterChip active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>All ({counts.total})</FilterChip>
          <FilterChip active={statusFilter === 'open'} onClick={() => setStatusFilter('open')}>Open ({counts.open})</FilterChip>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5">
        <KPI label="Total letters" value={counts.total} />
        <KPI label="High urgency open" value={counts.high} color={counts.high > 0 ? 'text-red-600' : 'text-ink-faint'} />
        <KPI label="Open" value={counts.open} color={counts.open > 0 ? 'text-orange-600' : 'text-ink-faint'} />
      </div>

      {/* Upload */}
      <div className="bg-surface border border-border rounded-lg p-4 mb-5">
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-[11px] uppercase tracking-wide font-semibold text-ink-muted mb-1">Entity (optional)</label>
            <select
              value={selectedEntity}
              onChange={e => setSelectedEntity(e.target.value)}
              className="w-full border border-border-strong rounded px-2 py-1.5 text-[12px] focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="">— unassigned —</option>
              {entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <input ref={fileInput} type="file" accept=".pdf,.png,.jpg,.jpeg" multiple
            className="hidden" onChange={e => handleUpload(e.target.files)} />
          <button
            onClick={() => fileInput.current?.click()}
            disabled={uploading}
            className="h-9 px-4 rounded bg-brand-500 text-white text-[12px] font-semibold hover:bg-brand-600 disabled:opacity-40 cursor-pointer transition-all duration-150"
          >
            {uploading ? 'Uploading & classifying…' : 'Upload AED letter'}
          </button>
        </div>
      </div>

      {/* Letters table */}
      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        {visible.length === 0 ? (
          <div className="p-8 text-center text-[12px] text-ink-faint">No letters yet.</div>
        ) : (
          <table className="w-full text-[12px]">
            <thead className="bg-surface-alt text-ink-soft border-b border-border">
              <tr>
                <th className="px-3 py-2 text-left font-medium uppercase tracking-wide text-[10px]">Type</th>
                <th className="px-3 py-2 text-left font-medium uppercase tracking-wide text-[10px]">Entity</th>
                <th className="px-3 py-2 text-left font-medium uppercase tracking-wide text-[10px]">Reference</th>
                <th className="px-3 py-2 text-left font-medium uppercase tracking-wide text-[10px]">Summary</th>
                <th className="px-3 py-2 text-right font-medium uppercase tracking-wide text-[10px]">Amount</th>
                <th className="px-3 py-2 text-left font-medium uppercase tracking-wide text-[10px]">Deadline</th>
                <th className="px-3 py-2 text-left font-medium uppercase tracking-wide text-[10px]">Urgency</th>
                <th className="px-3 py-2 text-left font-medium uppercase tracking-wide text-[10px]">Status</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {visible.map(l => (
                <tr key={l.id} className="border-b border-divider last:border-0 hover:bg-surface-alt/60 transition-colors duration-150">
                  <td className="px-3 py-2"><TypePill type={l.type} /></td>
                  <td className="px-3 py-2 text-ink-soft">{l.entity_name || <span className="text-ink-faint">—</span>}</td>
                  <td className="px-3 py-2 text-ink-soft font-mono text-[11px]">{l.reference || '—'}</td>
                  <td className="px-3 py-2 text-ink-soft max-w-md">
                    <div className="line-clamp-2">{l.summary || <button onClick={() => openLetter(l.id)} className="text-brand-600 hover:underline cursor-pointer">Open to review</button>}</div>
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-ink-soft">{l.amount != null ? `€${Number(l.amount).toLocaleString('en-LU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}</td>
                  <td className="px-3 py-2 text-ink-soft">{formatDate(l.deadline_date)}</td>
                  <td className="px-3 py-2"><UrgencyPill urgency={l.urgency} /></td>
                  <td className="px-3 py-2"><StatusPill status={l.status} /></td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <button onClick={() => openLetter(l.id)} className="text-brand-600 hover:underline text-[11px] font-medium cursor-pointer">View</button>
                    {l.status === 'received' && <> · <button onClick={() => setStatus(l.id, 'reviewed')} className="text-brand-600 hover:underline text-[11px] font-medium cursor-pointer">Mark reviewed</button></>}
                    {l.status === 'reviewed' && <> · <button onClick={() => setStatus(l.id, 'actioned')} className="text-brand-600 hover:underline text-[11px] font-medium cursor-pointer">Mark actioned</button></>}
                    {l.status !== 'archived' && <> · <button onClick={() => setStatus(l.id, 'archived')} className="text-ink-faint hover:underline text-[11px] cursor-pointer">Archive</button></>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function TypePill({ type }: { type: string | null }) {
  if (!type) return <span className="text-[10px] text-ink-faint">—</span>;
  const map: Record<string, string> = {
    extrait_de_compte: 'bg-surface-alt text-ink-soft',
    fixation_d_acompte: 'bg-red-100 text-red-700',
    bulletin_d_information: 'bg-amber-100 text-amber-700',
    demande_de_renseignements: 'bg-orange-100 text-orange-700',
    other: 'bg-surface-alt text-ink-soft',
  };
  return <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${map[type] || 'bg-surface-alt'}`}>{type.replace(/_/g, ' ')}</span>;
}
function UrgencyPill({ urgency }: { urgency: string | null }) {
  if (!urgency) return <span className="text-[10px] text-ink-faint">—</span>;
  const map: Record<string, string> = {
    high: 'bg-red-100 text-red-700',
    medium: 'bg-amber-100 text-amber-700',
    low: 'bg-surface-alt text-ink-soft',
  };
  return <span className={`text-[10px] px-2 py-0.5 rounded font-semibold uppercase tracking-wide ${map[urgency] || 'bg-surface-alt'}`}>{urgency}</span>;
}
function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    received: 'bg-blue-100 text-blue-700',
    reviewed: 'bg-purple-100 text-purple-700',
    actioned: 'bg-green-100 text-green-700',
    archived: 'bg-surface-alt text-ink-muted',
  };
  return <span className={`text-[10px] px-2 py-0.5 rounded font-semibold uppercase tracking-wide ${map[status] || 'bg-surface-alt'}`}>{status}</span>;
}
function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`h-7 px-2.5 rounded text-[11px] font-medium transition-colors duration-150 cursor-pointer ${
        active ? 'bg-brand-500 text-white' : 'border border-border-strong text-ink-soft hover:bg-surface-alt'
      }`}
    >
      {children}
    </button>
  );
}
function KPI({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div className="bg-surface border border-border rounded-lg p-3">
      <div className="text-[10px] text-ink-muted uppercase tracking-wide font-semibold">{label}</div>
      <div className={`text-2xl font-bold mt-1 tabular-nums ${color || 'text-ink'}`}>{value}</div>
    </div>
  );
}
function formatDate(d: string | null): string {
  if (!d) return '—';
  const parts = d.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return d;
}
