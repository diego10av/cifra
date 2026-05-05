// Single-user reset 2026-05-05: `/` was a server redirect to /tax-ops.
// Diego asked for a real home dashboard (item 7 from his post-reset
// punch list). Now `/` renders HomeDashboard — Today's focus + Quick
// actions + Module summaries. Login form sends users to /tax-ops
// directly so this page is reached deliberately, not as a transit.

export const dynamic = 'force-dynamic';

import { HomeDashboard } from '@/components/home/HomeDashboard';

export default function HomePage() {
  return <HomeDashboard />;
}
