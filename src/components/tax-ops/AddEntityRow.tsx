'use client';

// ════════════════════════════════════════════════════════════════════════
// AddEntityRow — stint 37.F.
//
// "+ Add entity" button at the end of each client-group section in a
// matrix page. Click → inline input row expands, Diego types the legal
// name, Enter → creates:
//   1. entity (with client_group_id set to the family being added to)
//   2. obligation of the current matrix tax_type + period_pattern
//   3. refetch the matrix — new row appears
//
// Creates are sequential (entity POST → obligation POST) so the
// obligation knows the new entity_id. One refetch at the end.
// ════════════════════════════════════════════════════════════════════════

import { useState, useRef, useEffect } from 'react';
import { PlusIcon } from 'lucide-react';

interface Props {
  groupId: string | null;
  groupName: string;
  taxType: string;
  periodPattern: string;
  serviceKind?: 'filing' | 'review';
  /**
   * Stint 40.D — optional extra obligations to create in parallel with
   * the main one. Used on BCL pages so "+ Add entity" under SBS also
   * sets up the BCL 2.16 monthly obligation (every BCL-subject entity
   * does both reports; forcing Diego to add them twice was friction).
   * Each extra obligation creates after the main obligation; if any
   * fails the entity is still created (no rollback) and the error is
   * surfaced — Diego can add the missing one via the other page.
   */
  additionalObligations?: Array<{
    tax_type: string;
    period_pattern: string;
    service_kind?: 'filing' | 'review';
  }>;
  onCreated: () => void;
}

export function AddEntityRow({
  groupId, groupName, taxType, periodPattern, serviceKind = 'filing',
  additionalObligations, onCreated,
}: Props) {
  const [mode, setMode] = useState<'button' | 'input'>('button');
  const [legalName, setLegalName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mode === 'input') inputRef.current?.focus();
  }, [mode]);

  async function create() {
    const name = legalName.trim();
    if (!name || busy) return;
    setBusy(true);
    setError(null);
    try {
      // 1. Create entity
      const entRes = await fetch('/api/tax-ops/entities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          legal_name: name,
          client_group_id: groupId,
        }),
      });
      if (!entRes.ok) {
        const b = await entRes.json().catch(() => ({}));
        throw new Error(b?.error ?? `Entity create failed (${entRes.status})`);
      }
      const { id: entityId } = await entRes.json() as { id: string };

      // 2. Create obligation for the current matrix scope
      const oblRes = await fetch('/api/tax-ops/obligations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_id: entityId,
          tax_type: taxType,
          period_pattern: periodPattern,
          service_kind: serviceKind,
        }),
      });
      if (!oblRes.ok) {
        const b = await oblRes.json().catch(() => ({}));
        throw new Error(b?.error ?? `Obligation create failed (${oblRes.status})`);
      }

      // 3. Create any additional obligations (e.g. BCL companion report).
      //    Non-fatal: if one fails we surface a soft error but the entity
      //    and the main obligation are already created.
      if (additionalObligations?.length) {
        const extraErrors: string[] = [];
        for (const extra of additionalObligations) {
          const r = await fetch('/api/tax-ops/obligations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              entity_id: entityId,
              tax_type: extra.tax_type,
              period_pattern: extra.period_pattern,
              service_kind: extra.service_kind ?? 'filing',
            }),
          });
          if (!r.ok) {
            const b = await r.json().catch(() => ({}));
            extraErrors.push(`${extra.tax_type}: ${b?.error ?? r.status}`);
          }
        }
        if (extraErrors.length) {
          setError(`Partial: ${extraErrors.join('; ')}`);
        }
      }

      setLegalName('');
      setMode('button');
      onCreated();
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  }

  if (mode === 'button') {
    return (
      <button
        type="button"
        onClick={() => setMode('input')}
        className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-brand-700 px-2 py-1"
      >
        <PlusIcon size={11} /> Add entity to {groupName || '(no family)'}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5 px-2 py-1">
      <PlusIcon size={11} className="text-ink-muted" />
      <input
        ref={inputRef}
        value={legalName}
        onChange={(e) => setLegalName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); void create(); }
          else if (e.key === 'Escape') {
            e.preventDefault();
            setLegalName('');
            setMode('button');
          }
        }}
        placeholder={`Legal name (adding to ${groupName || '(no family)'})`}
        disabled={busy}
        className="flex-1 min-w-[220px] max-w-[360px] px-2 py-0.5 text-sm border border-border rounded bg-surface"
      />
      <button
        type="button"
        onClick={() => void create()}
        disabled={busy || !legalName.trim()}
        className="px-2 py-0.5 text-xs rounded bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50"
      >
        {busy ? 'Creating…' : 'Add'}
      </button>
      <button
        type="button"
        onClick={() => { setLegalName(''); setMode('button'); }}
        className="px-2 py-0.5 text-xs rounded border border-border hover:bg-surface-alt"
      >
        Cancel
      </button>
      {error && <span className="text-2xs text-danger-700" title={error}>⚠</span>}
    </div>
  );
}
