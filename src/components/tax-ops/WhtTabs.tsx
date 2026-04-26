'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Stint 40.E — Ad-hoc tab added for entities whose WHT cadence is
// irregular (director fees paid at arbitrary intervals). Ad-hoc
// filings live in /tax-ops/other.
const TABS = [
  { href: '/tax-ops/wht/monthly',                          label: 'Monthly' },
  { href: '/tax-ops/wht/semester',                         label: 'Semester' },
  { href: '/tax-ops/wht/annual',                           label: 'Annual summary' },
  { href: '/tax-ops/other',                                label: 'Ad-hoc', tooltip: 'Irregular director-fee WHT filings (in the ad-hoc list)' },
];

export function WhtTabs() {
  const pathname = usePathname();
  return (
    <div className="flex gap-1 border-b border-border">
      {TABS.map(tab => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            title={tab.tooltip}
            className={[
              'px-3 py-1.5 text-sm border-b-2 transition-colors',
              isActive
                ? 'border-brand-500 text-brand-700 font-medium'
                : 'border-transparent text-ink-muted hover:text-ink hover:border-border-strong',
            ].join(' ')}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
