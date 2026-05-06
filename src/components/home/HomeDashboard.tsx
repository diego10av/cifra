'use client';

// ════════════════════════════════════════════════════════════════════════
// HomeDashboard — landing page when Diego signs in or hits `/`.
//
// 2026-05-05 redesign per Diego ("la home no es muy visual, imagínate
// ser un diseñador top con un taste increíble"):
//   - Editorial-feeling hero with the day-aware greeting in serif.
//   - Today's focus cards now tint their background by tone when they
//     have a value (amber / red / brand) so urgency reads at a glance.
//     "All clear" cards stay quiet so they don't compete for attention.
//   - Modules section uses a richer card with a hairline stat row and a
//     tagline rather than just a number.
//   - Quick actions row stays compact, separated by a subtle divider.
//   - Whole page is < 1 viewport at 1440×900 by design (1-screen rule).
// ════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangleIcon, MailWarningIcon, CheckSquareIcon, FileTextIcon,
  PlusIcon, ArrowRightIcon, ReceiptIcon, BarChart3Icon, BriefcaseIcon,
  CheckIcon,
} from 'lucide-react';
import { PageContainer } from '@/components/ui/PageContainer';

interface HomeSnapshot {
  todayFocus: {
    overdueFilings: number;
    aedUrgent: number;
    taxOpsTasksToday: number;
    crmTasksToday: number;
    declarationsInReview: number;
  };
  modules: {
    vat: number;
    taxOps: number;
    crm: number;
  };
}

const EMPTY: HomeSnapshot = {
  todayFocus: { overdueFilings: 0, aedUrgent: 0, taxOpsTasksToday: 0, crmTasksToday: 0, declarationsInReview: 0 },
  modules: { vat: 0, taxOps: 0, crm: 0 },
};

export function HomeDashboard() {
  const [data, setData] = useState<HomeSnapshot>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/home')
      .then(r => (r.ok ? r.json() : EMPTY))
      .then((s: HomeSnapshot) => {
        if (!cancelled) setData(s);
      })
      .catch(() => { /* keep EMPTY */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const greeting = greetingForLocalTime();
  const today = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  }).format(new Date());

  const totalUrgent =
    data.todayFocus.overdueFilings +
    data.todayFocus.aedUrgent +
    data.todayFocus.taxOpsTasksToday +
    data.todayFocus.crmTasksToday +
    data.todayFocus.declarationsInReview;

  return (
    <PageContainer width="wide">
      {/* ─── Editorial header ───────────────────────────────── */}
      <header className="mb-10 pb-6 border-b border-divider">
        <p className="text-2xs uppercase tracking-[0.14em] text-ink-faint font-semibold mb-2">
          {today}
        </p>
        <h1
          className="font-serif text-3xl md:text-4xl font-medium text-ink leading-[1.05]"
          style={{ letterSpacing: '-0.02em' }}
        >
          {greeting}.
        </h1>
        <p className="text-base text-ink-muted mt-3 max-w-xl leading-relaxed">
          {loading
            ? <span className="text-ink-faint">Loading focus…</span>
            : totalUrgent === 0
              ? <span className="inline-flex items-center gap-1.5"><CheckIcon size={15} className="text-success-500" /> Inbox is clear. Nothing demands your attention right now.</span>
              : <span>You have <strong className="text-ink">{totalUrgent}</strong> {totalUrgent === 1 ? 'item' : 'items'} that need attention today.</span>}
        </p>
      </header>

      {/* ─── Today's focus ─────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="text-2xs font-semibold uppercase tracking-[0.14em] text-accent-600 mb-3">
          Today&apos;s focus
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <FocusCard
            count={data.todayFocus.overdueFilings}
            label="overdue filings"
            href="/tax-ops"
            icon={<AlertTriangleIcon size={16} />}
            tone="danger"
          />
          <FocusCard
            count={data.todayFocus.aedUrgent}
            label="AED letters urgent"
            href="/aed-letters?urgency=high"
            icon={<MailWarningIcon size={16} />}
            tone="warning"
          />
          <FocusCard
            count={data.todayFocus.taxOpsTasksToday}
            label="tax-ops tasks due"
            href="/tax-ops/tasks?preset=overdue"
            icon={<CheckSquareIcon size={16} />}
            tone="brand"
          />
          <FocusCard
            count={data.todayFocus.crmTasksToday}
            label="CRM tasks due"
            href="/crm/tasks"
            icon={<BriefcaseIcon size={16} />}
            tone="brand"
          />
          <FocusCard
            count={data.todayFocus.declarationsInReview}
            label="declarations in review"
            href="/declarations?status=review"
            icon={<FileTextIcon size={16} />}
            tone="brand"
          />
        </div>
      </section>

      {/* ─── Quick actions ─────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="text-2xs font-semibold uppercase tracking-[0.14em] text-accent-600 mb-3">
          Quick actions
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <QuickAction href="/declarations" label="New VAT declaration" />
          <QuickAction href="/crm/matters" label="New CRM matter" />
          <QuickAction href="/aed-letters" label="Upload AED letter" />
        </div>
      </section>

      {/* ─── Stint 84.E — Chase today: stale waiting-on-* tasks. ─── */}
      <ChaseToday />


      {/* ─── Modules ────────────────────────────────────── */}
      <section>
        <h2 className="text-2xs font-semibold uppercase tracking-[0.14em] text-accent-600 mb-3">
          Modules
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <ModuleCard
            href="/declarations"
            icon={<ReceiptIcon size={18} />}
            title="VAT"
            stat={data.modules.vat}
            statLabel={data.modules.vat === 1 ? 'declaration in flight' : 'declarations in flight'}
            description="Invoices · classifier · eCDF · AED letters"
          />
          <ModuleCard
            href="/tax-ops"
            icon={<BarChart3Icon size={18} />}
            title="Tax-Ops"
            stat={data.modules.taxOps}
            statLabel={data.modules.taxOps === 1 ? 'filing this week' : 'filings this week'}
            description="Form 500 · WHT · subscription tax + BCL · FATCA/CRS"
          />
          <ModuleCard
            href="/crm"
            icon={<BriefcaseIcon size={18} />}
            title="CRM"
            stat={data.modules.crm}
            statLabel={data.modules.crm === 1 ? 'active matter' : 'active matters'}
            description="Companies · contacts · matters · billing"
          />
        </div>
      </section>
    </PageContainer>
  );
}

// ─── Stint 84.E — ChaseToday: stale waiting-on-* tasks ──────────────────
//
// Surfaces every task that has been in waiting_on_external /
// waiting_on_internal status for >5 days without a new comment. The
// "no se me olvide perseguir a quien me debe" pain Diego flagged.
// Hidden when there's nothing to chase — the section disappears so
// it doesn't add noise on a quiet day.

interface StaleTask {
  id: string;
  title: string;
  status: string;
  stale_days: number | null;
  entity_name: string | null;
  family_name: string | null;
  parent_task_id: string | null;
}

function ChaseToday() {
  const [items, setItems] = useState<StaleTask[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/tax-ops/tasks?stale=1')
      .then(r => (r.ok ? r.json() : { tasks: [] }))
      .then((b: { tasks: StaleTask[] }) => {
        if (!cancelled) setItems(b.tasks ?? []);
      })
      .catch(() => { if (!cancelled) setItems([]); });
    return () => { cancelled = true; };
  }, []);

  if (items === null || items.length === 0) return null;

  const sorted = [...items].sort((a, b) => (b.stale_days ?? 0) - (a.stale_days ?? 0));

  return (
    <section className="mb-10">
      <h2 className="text-2xs font-semibold uppercase tracking-[0.14em] text-danger-600 mb-3">
        Chase today
        <span className="ml-2 text-2xs text-ink-muted font-normal normal-case tracking-normal">
          {items.length} task{items.length === 1 ? '' : 's'} waiting &gt; 5 days without an update
        </span>
      </h2>
      <ul className="rounded-md border border-danger-200 bg-danger-50/30 divide-y divide-danger-200/60">
        {sorted.slice(0, 8).map(t => (
          <li key={t.id} className="flex items-center gap-3 px-3 py-2">
            <span
              className="shrink-0 inline-flex items-center justify-center min-w-[2.5rem] h-6 px-1.5 rounded text-2xs font-semibold bg-danger-500 text-white tabular-nums"
              title={`Waiting ${t.stale_days ?? 5}d without an update`}
            >
              {t.stale_days ?? 5}d
            </span>
            <div className="flex-1 min-w-0">
              <Link
                href={`/tax-ops/tasks/${t.parent_task_id ?? t.id}`}
                className="text-sm text-ink hover:text-brand-700 hover:underline truncate inline-block max-w-full"
              >
                {t.title}
              </Link>
              {(t.family_name || t.entity_name) && (
                <span className="ml-2 text-2xs text-ink-muted">
                  {t.family_name ?? ''}
                  {t.family_name && t.entity_name ? ' › ' : ''}
                  {t.entity_name ?? ''}
                </span>
              )}
            </div>
            <span className="text-2xs text-danger-700 font-medium uppercase tracking-wide">
              {t.status === 'waiting_on_external' ? 'External' : 'Internal'}
            </span>
          </li>
        ))}
        {sorted.length > 8 && (
          <li className="px-3 py-2 text-xs text-ink-muted">
            <Link href="/tax-ops/tasks?status=waiting_on_external&status=waiting_on_internal" className="hover:underline text-brand-700">
              … and {sorted.length - 8} more — open in Tasks list
            </Link>
          </li>
        )}
      </ul>
    </section>
  );
}

// ─── FocusCard ──────────────────────────────────────────────────────────

type Tone = 'danger' | 'warning' | 'brand';

const TONE_MAP: Record<Tone, {
  activeBg: string;
  activeBorder: string;
  iconBg: string;
  iconText: string;
  numText: string;
}> = {
  danger: {
    activeBg: 'bg-danger-50',
    activeBorder: 'border-danger-500/30',
    iconBg: 'bg-danger-500',
    iconText: 'text-white',
    numText: 'text-danger-700',
  },
  warning: {
    activeBg: 'bg-warning-50',
    activeBorder: 'border-warning-500/30',
    iconBg: 'bg-warning-500',
    iconText: 'text-white',
    numText: 'text-warning-700',
  },
  brand: {
    activeBg: 'bg-brand-50',
    activeBorder: 'border-brand-500/30',
    iconBg: 'bg-brand-500',
    iconText: 'text-white',
    numText: 'text-brand-700',
  },
};

function FocusCard({
  count, label, href, icon, tone,
}: {
  count: number;
  label: string;
  href: string;
  icon: React.ReactNode;
  tone: Tone;
}) {
  const isClear = count === 0;
  const t = TONE_MAP[tone];

  return (
    <Link
      href={href}
      className={[
        'group relative block rounded-lg border p-4 transition-all',
        isClear
          ? 'border-border bg-surface hover:border-border-strong'
          : `${t.activeBorder} ${t.activeBg} hover:shadow-sm`,
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className={[
          'inline-flex w-7 h-7 items-center justify-center rounded-md',
          isClear ? 'bg-surface-alt text-ink-muted' : `${t.iconBg} ${t.iconText}`,
        ].join(' ')}>
          {icon}
        </div>
        <ArrowRightIcon
          size={13}
          className="text-ink-faint opacity-0 group-hover:opacity-100 transition-opacity mt-1"
        />
      </div>
      <div className={[
        'text-3xl font-semibold leading-none tabular-nums',
        isClear ? 'text-ink-muted' : t.numText,
      ].join(' ')}>
        {isClear ? '—' : count}
      </div>
      <div className={[
        'text-xs mt-2',
        isClear ? 'text-ink-muted' : 'text-ink-soft',
      ].join(' ')}>
        {isClear ? `No ${label} ✓` : label}
      </div>
    </Link>
  );
}

// ─── QuickAction ────────────────────────────────────────────────────────

function QuickAction({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md bg-surface border border-border-strong text-ink-soft text-sm font-medium hover:bg-surface-alt hover:text-ink hover:border-ink-muted transition-colors"
    >
      <PlusIcon size={14} />
      {label}
    </Link>
  );
}

// ─── ModuleCard ─────────────────────────────────────────────────────────

function ModuleCard({
  href, icon, title, stat, statLabel, description,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  stat: number;
  statLabel: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group block rounded-lg border border-border bg-surface p-5 hover:border-border-strong transition-colors"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="inline-flex w-9 h-9 items-center justify-center rounded-md bg-brand-50 text-brand-700">
          {icon}
        </div>
        <ArrowRightIcon
          size={14}
          className="text-ink-faint opacity-0 group-hover:opacity-100 transition-opacity mt-1.5"
        />
      </div>
      <h3 className="font-serif text-xl font-medium text-ink mb-1 leading-tight">
        {title}
      </h3>
      <p className="text-2xs uppercase tracking-wider text-ink-faint font-semibold mb-3">
        {description}
      </p>
      <div className="flex items-baseline gap-1.5 pt-3 border-t border-divider">
        <span className="text-lg font-semibold text-ink tabular-nums">{stat}</span>
        <span className="text-xs text-ink-muted">{statLabel}</span>
      </div>
    </Link>
  );
}

// ─── helpers ────────────────────────────────────────────────────────────

function greetingForLocalTime(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning, Diego';
  if (h < 18) return 'Good afternoon, Diego';
  return 'Good evening, Diego';
}
