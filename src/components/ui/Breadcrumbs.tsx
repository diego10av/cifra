import Link from 'next/link';
import { ChevronRightIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export interface Crumb {
  label: ReactNode;
  href?: string;
}

export function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm mb-3">
      {crumbs.map((c, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <span key={i} className="inline-flex items-center gap-1 min-w-0">
            {i > 0 && <ChevronRightIcon size={12} className="text-ink-faint shrink-0" />}
            {c.href && !isLast ? (
              <Link href={c.href} className="text-ink-muted hover:text-ink transition-colors truncate">
                {c.label}
              </Link>
            ) : (
              <span className={isLast ? 'text-ink font-medium truncate' : 'text-ink-muted truncate'}>
                {c.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
