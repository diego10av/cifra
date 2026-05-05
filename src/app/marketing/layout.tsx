// Marketing layout — no AppShell (no sidebar, no topbar). The landing
// page renders its own minimal chrome (top nav + hero + cards + footer).
//
// Set noindex/nofollow at the layout level: while cifra is dogfood-only
// the landing should not surface in search engines. When (if) Diego
// decides to sell, flip these flags.

import type { Metadata } from 'next';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
