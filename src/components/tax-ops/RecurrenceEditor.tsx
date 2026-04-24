'use client';

// RecurrenceEditor — compact inline UI for tax_ops_tasks.recurrence_rule.
// Matches the shapes consumed by /api/tax-ops/scheduled/recurrence-expand.

import { useState, useEffect } from 'react';

export type RecurrenceRule =
  | { type: 'weekly';        params: { day_of_week: number } }
  | { type: 'monthly';       params: { day_of_month: number } }
  | { type: 'quarterly';     params: { day_of_month: number } }
  | { type: 'yearly';        params: { month: number; day: number } }
  | { type: 'every_n_days';  params: { n: number } };

const DAYS_OF_WEEK = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 7, label: 'Sunday' },
];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function describeRecurrence(rule: RecurrenceRule | null | undefined): string {
  if (!rule) return '';
  switch (rule.type) {
    case 'weekly': {
      const d = DAYS_OF_WEEK.find(x => x.value === rule.params.day_of_week);
      return `Every ${d?.label ?? 'week'}`;
    }
    case 'monthly':
      return `Monthly on day ${rule.params.day_of_month}`;
    case 'quarterly':
      return `Every quarter on day ${rule.params.day_of_month}`;
    case 'yearly': {
      return `Yearly on ${rule.params.day} ${MONTHS[rule.params.month - 1] ?? ''}`.trim();
    }
    case 'every_n_days':
      return `Every ${rule.params.n} days`;
  }
}

export function RecurrenceEditor({
  value, onChange,
}: {
  value: RecurrenceRule | null;
  onChange: (next: RecurrenceRule | null) => void;
}) {
  const [enabled, setEnabled] = useState(!!value);
  const [rule, setRule] = useState<RecurrenceRule>(
    value ?? { type: 'monthly', params: { day_of_month: 15 } },
  );

  useEffect(() => {
    if (value) {
      setEnabled(true);
      setRule(value);
    } else {
      setEnabled(false);
    }
  }, [value]);

  function toggle(on: boolean) {
    setEnabled(on);
    onChange(on ? rule : null);
  }

  function updateRule(next: RecurrenceRule) {
    setRule(next);
    if (enabled) onChange(next);
  }

  function switchType(type: RecurrenceRule['type']) {
    let next: RecurrenceRule;
    switch (type) {
      case 'weekly':       next = { type, params: { day_of_week: 1 } }; break;
      case 'monthly':      next = { type, params: { day_of_month: 15 } }; break;
      case 'quarterly':    next = { type, params: { day_of_month: 15 } }; break;
      case 'yearly':       next = { type, params: { month: 1, day: 15 } }; break;
      case 'every_n_days': next = { type, params: { n: 7 } }; break;
    }
    updateRule(next);
  }

  return (
    <div className="space-y-2">
      <label className="inline-flex items-center gap-2 text-[12.5px]">
        <input type="checkbox" checked={enabled} onChange={e => toggle(e.target.checked)} />
        Recurring task
      </label>

      {enabled && (
        <div className="rounded-md border border-border bg-surface-alt/40 p-2 space-y-2 text-[12px]">
          <label className="block">
            <span className="text-ink-muted">Cadence</span>
            <select
              value={rule.type}
              onChange={e => switchType(e.target.value as RecurrenceRule['type'])}
              className="mt-1 w-full px-2 py-1 border border-border rounded-md bg-surface"
            >
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
              <option value="every_n_days">Every N days</option>
            </select>
          </label>

          {rule.type === 'weekly' && (
            <label className="block">
              <span className="text-ink-muted">Day of week</span>
              <select
                value={rule.params.day_of_week}
                onChange={e => updateRule({ type: 'weekly', params: { day_of_week: Number(e.target.value) } })}
                className="mt-1 w-full px-2 py-1 border border-border rounded-md bg-surface"
              >
                {DAYS_OF_WEEK.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </label>
          )}

          {rule.type === 'monthly' && (
            <label className="block">
              <span className="text-ink-muted">Day of month</span>
              <input
                type="number" min={1} max={31}
                value={rule.params.day_of_month}
                onChange={e => updateRule({ type: 'monthly', params: { day_of_month: Number(e.target.value) } })}
                className="mt-1 w-full px-2 py-1 border border-border rounded-md bg-surface tabular-nums"
              />
            </label>
          )}

          {rule.type === 'quarterly' && (
            <label className="block">
              <span className="text-ink-muted">Day of month (of each quarter)</span>
              <input
                type="number" min={1} max={31}
                value={rule.params.day_of_month}
                onChange={e => updateRule({ type: 'quarterly', params: { day_of_month: Number(e.target.value) } })}
                className="mt-1 w-full px-2 py-1 border border-border rounded-md bg-surface tabular-nums"
              />
            </label>
          )}

          {rule.type === 'yearly' && (
            <div className="grid grid-cols-2 gap-2">
              <label>
                <span className="text-ink-muted">Month</span>
                <select
                  value={rule.params.month}
                  onChange={e => updateRule({ type: 'yearly', params: { ...rule.params, month: Number(e.target.value) } })}
                  className="mt-1 w-full px-2 py-1 border border-border rounded-md bg-surface"
                >
                  {MONTHS.map((name, i) => <option key={i} value={i + 1}>{name}</option>)}
                </select>
              </label>
              <label>
                <span className="text-ink-muted">Day</span>
                <input
                  type="number" min={1} max={31}
                  value={rule.params.day}
                  onChange={e => updateRule({ type: 'yearly', params: { ...rule.params, day: Number(e.target.value) } })}
                  className="mt-1 w-full px-2 py-1 border border-border rounded-md bg-surface tabular-nums"
                />
              </label>
            </div>
          )}

          {rule.type === 'every_n_days' && (
            <label className="block">
              <span className="text-ink-muted">Every N days</span>
              <input
                type="number" min={1} max={365}
                value={rule.params.n}
                onChange={e => updateRule({ type: 'every_n_days', params: { n: Number(e.target.value) } })}
                className="mt-1 w-full px-2 py-1 border border-border rounded-md bg-surface tabular-nums"
              />
            </label>
          )}

          <div className="text-[11px] text-ink-muted italic">
            Description: {describeRecurrence(rule)}
          </div>
        </div>
      )}
    </div>
  );
}
