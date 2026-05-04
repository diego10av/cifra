'use client';

import { useState } from 'react';
import { CalendarPlusIcon } from 'lucide-react';
import { TaxOpsHomeWidgets } from '@/components/tax-ops/HomeWidgets';
import { TasksDueWidget } from '@/components/tax-ops/TasksDueWidget';
import { StuckFollowUpsWidget } from '@/components/tax-ops/StuckFollowUpsWidget';
import { RolloverModal } from '@/components/tax-ops/RolloverModal';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageContainer } from '@/components/ui/PageContainer';
import { Button } from '@/components/ui/Button';

// /tax-ops home — daily landing for compliance work.
//
// Stint 65.D — "Browse by tax type" 6-card grid removed (Diego, audit
// 2026-04-30): "el 6-card grid es navegación que ya tienes en sidebar.
// Lo quitaría o lo demote a footer del Overview." Strict actionable-
// first read: the cards never trigger work, only navigation, and the
// sidebar carries the same routes for free. Removing them lets the
// "Today's focus" widgets dominate the viewport without visual rivals.
//
// Layout, top to bottom:
//   1. Header + "Open {nextYear}" button (the only headline action).
//   2. Today's focus
//      ├── Tasks due this week (TasksDueWidget)
//      ├── Stuck follow-ups (StuckFollowUpsWidget — self-hides when
//      │   nothing is stuck, so a caught-up day shows zero noise)
//      └── Filings 2×2 grid (Deadline radar / My action / Client
//          approval / Stale assessments)
//
// Sidebar already lists every tax-type category (CIT / VAT / Sub-tax
// / WHT / BCL / FATCA / Other) so the user is never more than one
// click from any matrix.

export default function TaxOpsHomePage() {
  const [rolloverOpen, setRolloverOpen] = useState(false);
  const nextYear = new Date().getFullYear() + 1;

  return (
    <PageContainer width="wide">
      <div className="space-y-5">
      <PageHeader
        title="Tax-Ops"
        // Stint 65.F — mental-model statement so a new user (or Diego
        // crossing from /crm/*) immediately knows what this surface is
        // for. Pairs with the matching subtitle on /crm.
        subtitle="Compliance side. Track every Lux filing — deadlines, status, sign-off, audit trail. CRM lives in the parallel module."
        actions={
          <Button
            variant="primary"
            size="md"
            icon={<CalendarPlusIcon size={14} />}
            onClick={() => setRolloverOpen(true)}
          >
            Open {nextYear}
          </Button>
        }
      />

      {/* ── Today's focus ─────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-ink uppercase tracking-wide">
            Today&apos;s focus
          </h2>
          <span className="text-2xs text-ink-muted">
            Press{' '}
            <kbd className="text-2xs px-1 py-0.5 rounded bg-surface-alt border border-border">⌘K</kbd>
            {' '}for search ·{' '}
            <kbd className="text-2xs px-1 py-0.5 rounded bg-surface-alt border border-border">N</kbd>
            {' '}to capture a task
          </span>
        </div>
        <TasksDueWidget />
        {/* Stint 64.L Layer 3 — surfaces filings stuck waiting on the
            client. Self-hides when there's nothing to chase, so a
            caught-up day shows zero noise. */}
        <StuckFollowUpsWidget />
        <TaxOpsHomeWidgets />
      </section>

      <RolloverModal
        open={rolloverOpen}
        year={nextYear}
        onClose={() => setRolloverOpen(false)}
      />
      </div>
    </PageContainer>
  );
}
