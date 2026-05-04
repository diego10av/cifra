'use client';

// ════════════════════════════════════════════════════════════════════════
// /tax-ops — layout shared by all sub-routes of the Tax-Ops module.
//
// Independent from /crm (by Diego's explicit call — the Excels contain
// partners' clients that don't belong in his CRM book). Mirrors the
// CRM nav shape for muscle memory but routes its own URLs + data.
//
// Stint 65.C — top-tabs (Home / Tasks / Entities / Filings) removed.
// They duplicated sidebar items 1-for-1 (Diego's audit, 2026-04-30:
// "triple navegación redundante"). Linear / Notion canon: a single
// nav surface (sidebar) is enough. Filings is now a sidebar item so
// nothing is orphaned. The 56px vertical space the tabs consumed is
// returned to the page content, which matters on dense matrices.
//
// Settings + Help (formerly OverflowMenu in the top-tab strip) reach
// from the user menu in the topbar; both routes still exist.
// ════════════════════════════════════════════════════════════════════════

import { QuickCaptureModal } from '@/components/tax-ops/QuickCaptureModal';

export default function TaxOpsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-[1400px] mx-auto px-4 pt-4">
      <div>{children}</div>
      <QuickCaptureModal />
    </div>
  );
}
