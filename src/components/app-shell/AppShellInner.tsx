'use client';

// AppShellInner — the client-side shell that wraps every authenticated
// page with sidebar (left, fixed) + topbar + content column. Renamed
// from AppShell in stint 64.D when AppShell became a server component
// gate (see AppShell.tsx for the why).
//
// The shell owns the live badge counts so the same numbers that light
// up sidebar items also drive the home dashboard without re-fetching.

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar, type SidebarBadges } from './Sidebar';
import { TopBar } from './TopBar';
import { OfflineBanner } from './OfflineBanner';
import { FeedbackWidget } from '@/components/feedback/FeedbackWidget';
import { useSidebarCollapsed } from '@/lib/use-sidebar-collapsed';

interface Deadline { is_overdue: boolean; bucket: string; }

interface HomeSnapshot {
  todayFocus: {
    overdueFilings: number;
    aedUrgent: number;
    taxOpsTasksToday: number;
    crmTasksToday: number;
    declarationsInReview: number;
  };
}

export function AppShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/';
  const [badges, setBadges] = useState<SidebarBadges>({});
  const [collapsed] = useSidebarCollapsed();

  // Refresh badges when the user navigates. /api/home is the aggregator
  // for "what needs Diego's attention" — same data the home dashboard
  // uses, so navigation badges + Today's focus stay in sync. Deadlines
  // is fetched separately because /api/deadlines runs the
  // computeDeadline projection (per entity, per frequency) — that
  // logic isn't trivially portable to the aggregator.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [homeRes, dlRes] = await Promise.allSettled([
          fetch('/api/home').then(r => r.ok ? r.json() as Promise<HomeSnapshot> : null),
          fetch('/api/deadlines').then(r => r.ok ? r.json() : []),
        ]);
        if (cancelled) return;
        const home: HomeSnapshot | null = homeRes.status === 'fulfilled' ? homeRes.value : null;
        const deadlines: Deadline[] = dlRes.status === 'fulfilled' ? dlRes.value : [];
        const focus = home?.todayFocus;

        setBadges({
          declarationsInReview: focus?.declarationsInReview ?? 0,
          aedUrgent: focus?.aedUrgent ?? 0,
          deadlinesUrgent: deadlines.filter(d => d.is_overdue || d.bucket === 'urgent').length,
          taxOpsTasksToday: focus?.taxOpsTasksToday ?? 0,
          crmTasksToday: focus?.crmTasksToday ?? 0,
          taxOpsOverdueFilings: focus?.overdueFilings ?? 0,
        });
      } catch {
        /* silent — sidebar simply renders without counts */
      }
    }
    load();
    return () => { cancelled = true; };
  }, [pathname]);

  // Browser tab title reflects the live alert count so Diego sees
  // pending work even when cifra is in a background tab. Excludes
  // `deadlinesUrgent` intentionally — those are projected periods,
  // not action items hanging over today.
  useEffect(() => {
    const total =
      (badges.taxOpsTasksToday ?? 0) +
      (badges.crmTasksToday ?? 0) +
      (badges.aedUrgent ?? 0) +
      (badges.taxOpsOverdueFilings ?? 0) +
      (badges.declarationsInReview ?? 0);
    document.title = total > 0 ? `(${total}) cifra` : 'cifra';
  }, [badges]);

  return (
    <div className="min-h-screen">
      {/* Skip-to-content link — invisible until focused, lets keyboard
          users bypass the sidebar and jump straight to the page content.
          Visible on Tab from page load. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-toast focus:px-3 focus:py-2 focus:bg-brand-500 focus:text-white focus:rounded focus:shadow-lg focus:text-sm focus:font-medium"
      >
        Skip to main content
      </a>
      <OfflineBanner />
      <Sidebar badges={badges} />
      <div
        className={[
          'transition-[padding-left] duration-200',
          collapsed ? 'md:pl-[56px]' : 'md:pl-[232px]',
        ].join(' ')}
      >
        <TopBar badges={badges} />
        <main id="main-content" className="px-4 md:px-8 py-6 md:py-8 max-w-[1400px]">
          {children}
        </main>
      </div>
      <FeedbackWidget />
    </div>
  );
}
