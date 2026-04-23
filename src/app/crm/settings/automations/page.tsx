'use client';

// ════════════════════════════════════════════════════════════════════════
// /crm/settings/automations — list + enable/disable CRM automation
// rules. Each rule fires side-effects (create task, etc.) when a
// trigger event (opp stage change, invoice status change) matches its
// conditions.
//
// The 3 pre-seeded rules can be toggled; custom rule creation from
// the UI is intentionally out of scope for MVP. Advanced users can
// INSERT rows directly.
// ════════════════════════════════════════════════════════════════════════

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { ZapIcon, CheckCircle2Icon, CircleIcon } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { useToast } from '@/components/Toaster';
import { formatDate } from '@/lib/crm-types';

interface Rule {
  id: string;
  name: string;
  description: string | null;
  trigger_event: string;
  trigger_params: Record<string, unknown>;
  action_type: string;
  action_params: Record<string, unknown>;
  enabled: boolean;
  fire_count: number;
  last_fired_at: string | null;
  updated_at: string;
}

const TRIGGER_LABELS: Record<string, string> = {
  opportunity_stage_changed: 'When an opportunity changes stage',
  invoice_status_changed:    'When an invoice changes status',
  task_completed:            'When a task is marked done',
  matter_created:            'When a matter is opened',
};

export default function AutomationsPage() {
  const toast = useToast();
  const [rules, setRules] = useState<Rule[] | null>(null);

  const load = useCallback(() => {
    fetch('/api/crm/automations', { cache: 'no-store' })
      .then(r => r.json()).then(setRules).catch(() => setRules([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function toggle(id: string, enabled: boolean) {
    const res = await fetch('/api/crm/automations', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, enabled }),
    });
    if (!res.ok) { toast.error('Toggle failed'); return; }
    toast.success(enabled ? 'Rule enabled' : 'Rule disabled');
    load();
  }

  if (rules === null) {
    return <div className="text-[12px] text-ink-muted italic px-3 py-6">Loading automations…</div>;
  }

  // Group by trigger event for a cleaner presentation.
  const byTrigger = rules.reduce((acc, r) => {
    if (!acc[r.trigger_event]) acc[r.trigger_event] = [];
    acc[r.trigger_event].push(r);
    return acc;
  }, {} as Record<string, Rule[]>);

  return (
    <div className="max-w-[880px]">
      <div className="text-[11.5px] text-ink-muted mb-2">
        <Link href="/crm/settings" className="hover:underline">← Settings</Link>
      </div>
      <PageHeader
        title="Automations"
        subtitle={`${rules.filter(r => r.enabled).length}/${rules.length} rules enabled`}
      />
      <p className="text-[12.5px] text-ink-muted mb-4">
        Each rule fires a side-effect when its trigger matches. Disable any that don&apos;t fit your workflow.
        Advanced: add custom rules by INSERTing rows into <code className="font-mono text-[11px]">crm_automation_rules</code>.
      </p>

      <div className="space-y-5">
        {Object.entries(byTrigger).map(([trigger, list]) => (
          <div key={trigger} className="border border-border rounded-lg bg-white overflow-hidden">
            <div className="px-3 py-2 bg-surface-alt/40 border-b border-border flex items-center gap-2">
              <ZapIcon size={13} className="text-brand-600" />
              <span className="text-[12px] uppercase tracking-wide font-semibold text-ink-muted">
                {TRIGGER_LABELS[trigger] ?? trigger}
              </span>
            </div>
            <ul className="divide-y divide-border">
              {list.map(r => (
                <li key={r.id} className="px-3 py-2.5 flex items-start gap-3">
                  <button
                    onClick={() => toggle(r.id, !r.enabled)}
                    className={`shrink-0 mt-0.5 ${r.enabled ? 'text-emerald-600' : 'text-ink-muted hover:text-ink'}`}
                    title={r.enabled ? 'Disable' : 'Enable'}
                  >
                    {r.enabled ? <CheckCircle2Icon size={18} /> : <CircleIcon size={18} />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className={`text-[13px] font-medium ${r.enabled ? 'text-ink' : 'text-ink-muted line-through'}`}>
                      {r.name}
                    </div>
                    {r.description && (
                      <div className="text-[11.5px] text-ink-muted mt-0.5">{r.description}</div>
                    )}
                    <div className="text-[10.5px] text-ink-faint mt-1 font-mono">
                      {r.action_type}({Object.entries(r.action_params).map(([k, v]) => `${k}=${String(v)}`).join(', ')})
                    </div>
                  </div>
                  <div className="shrink-0 text-[10.5px] text-ink-muted text-right">
                    <div>Fired {r.fire_count}×</div>
                    {r.last_fired_at && (
                      <div className="italic">Last {formatDate(r.last_fired_at)}</div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
