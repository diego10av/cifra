'use client';

// ════════════════════════════════════════════════════════════════════════
// HomeDashboard — landing page when Diego signs in or hits `/`.
//
// Three sections, every element passes Rule §11 (actionable-first):
//   1. Today's focus  — 4 cards counting things that need action.
//   2. Quick actions  — 3 primary buttons saving navigation.
//   3. Modules        — 3 cards summarising VAT / Tax-Ops / CRM.
//
// Data comes from /api/home which aggregates 7 cheap COUNT queries in
// parallel. Each query is defensive — if a table breaks the affected
// card shows 0, never breaks the whole page.
// ════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangleIcon, MailWarningIcon, CheckSquareIcon, FileTextIcon,
  PlusIcon, ArrowRightIcon, ReceiptIcon, BarChart3Icon, BriefcaseIcon,
} from 'lucide-react';
import { PageContainer } from '@/components/ui/PageContainer';

interface HomeSnapshot {
  todayFocus: {
    overdueFilings: number;
    aedUrgent: number;
    tasksToday: number;
    declarationsInReview: number;
  };
  modules: {
    vat: number;
    taxOps: number;
    crm: number;
  };
}

const EMPTY: HomeSnapshot = {
  todayFocus: { overdueFilings: 0, aedUrgent: 0, tasksToday: 0, declarationsInReview: 0 },
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
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date());

  return (
    <PageContainer width="wide">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-ink leading-tight">{greeting}</h1>
        <p className="text-sm text-ink-muted mt-1">{today}</p>
      </header>

      {/* TODAY'S FOCUS */}
      <section className="mb-10">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-2xs font-semibold uppercase tracking-wider text-ink-muted">
            Today&apos;s focus
          </h2>
          {loading && <span className="text-2xs text-ink-faint">Loading…</span>}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
            count={data.todayFocus.tasksToday}
            label="tasks due today"
            href="/crm/tasks"
            icon={<CheckSquareIcon size={16} />}
            tone="info"
          />
          <FocusCard
            count={data.todayFocus.declarationsInReview}
            label="declarations in review"
            href="/declarations?status=review"
            icon={<FileTextIcon size={16} />}
            tone="info"
          />
        </div>
      </section>

      {/* QUICK ACTIONS */}
      <section className="mb-10">
        <h2 className="text-2xs font-semibold uppercase tracking-wider text-ink-muted mb-3">
          Quick actions
        </h2>
        <div className="flex flex-wrap gap-2">
          <QuickAction href="/declarations" label="New VAT declaration" />
          <QuickAction href="/crm/matters" label="New CRM matter" />
          <QuickAction href="/aed-letters" label="Upload AED letter" />
        </div>
      </section>

      {/* MODULES */}
      <section>
        <h2 className="text-2xs font-semibold uppercase tracking-wider text-ink-muted mb-3">
          Modules
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <ModuleCard
            href="/declarations"
            icon={<ReceiptIcon size={20} />}
            title="VAT"
            stat={data.modules.vat}
            statLabel={data.modules.vat === 1 ? 'declaration in flight' : 'declarations in flight'}
            description="Invoices · classifier · eCDF · AED letters"
          />
          <ModuleCard
            href="/tax-ops"
            icon={<BarChart3Icon size={20} />}
            title="Tax-Ops"
            stat={data.modules.taxOps}
            statLabel={data.modules.taxOps === 1 ? 'filing this week' : 'filings this week'}
            description="CIT · NWT · WHT · BCL · subscription tax"
          />
          <ModuleCard
            href="/crm"
            icon={<BriefcaseIcon size={20} />}
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

// ─── FocusCard ───────────────────────────────────────────────────────────

type Tone = 'danger' | 'warning' | 'info';

const TONE_MAP: Record<Tone, { bg: string; text: string; iconText: string }> = {
  danger:  { bg: 'bg-danger-50',  text: 'text-danger-700',  iconText: 'text-danger-600'  },
  warning: { bg: 'bg-warning-50', text: 'text-warning-700', iconText: 'text-warning-600' },
  info:    { bg: 'bg-brand-50',   text: 'text-brand-700',   iconText: 'text-brand-600'   },
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
        'group relative block rounded-lg border border-border bg-surface p-4',
        'hover:border-border-strong hover:bg-surface-alt/50 transition-colors',
        isClear ? 'opacity-70 hover:opacity-100' : '',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className={[
          'inline-flex w-7 h-7 items-center justify-center rounded-md',
          isClear ? 'bg-surface-alt text-ink-muted' : `${t.bg} ${t.iconText}`,
        ].join(' ')}>
          {icon}
        </div>
        <ArrowRightIcon
          size={13}
          className="text-ink-faint opacity-0 group-hover:opacity-100 transition-opacity mt-1"
        />
      </div>
      <div className="text-3xl font-semibold leading-none text-ink">
        {isClear ? '—' : count}
      </div>
      <div className="text-xs text-ink-muted mt-2">
        {isClear ? `No ${label} ✓` : label}
      </div>
    </Link>
  );
}

// ─── QuickAction ─────────────────────────────────────────────────────────

function QuickAction({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 transition-colors"
    >
      <PlusIcon size={14} />
      {label}
    </Link>
  );
}

// ─── ModuleCard ──────────────────────────────────────────────────────────

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
      className="group block rounded-lg border border-border bg-surface p-5 hover:border-border-strong hover:bg-surface-alt/50 transition-colors"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="inline-flex w-8 h-8 items-center justify-center rounded-md bg-brand-50 text-brand-700">
          {icon}
        </div>
        <h3 className="text-base font-semibold text-ink">{title}</h3>
        <ArrowRightIcon
          size={14}
          className="ml-auto text-ink-faint opacity-0 group-hover:opacity-100 transition-opacity"
        />
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-xl font-semibold text-ink">{stat}</span>
        <span className="text-xs text-ink-muted">{statLabel}</span>
      </div>
      <p className="text-xs text-ink-faint mt-2">{description}</p>
    </Link>
  );
}

// ─── helpers ─────────────────────────────────────────────────────────────

function greetingForLocalTime(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning, Diego';
  if (h < 18) return 'Good afternoon, Diego';
  return 'Good evening, Diego';
}
