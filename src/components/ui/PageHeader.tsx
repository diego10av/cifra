import type { ReactNode } from 'react';

/**
 * PageHeader — canonical title row for every page.
 *
 *   variant="default"  → text-xl (22px) + mb-6 — internal pages (canonical)
 *   variant="hero"     → text-2xl (26px) + mb-8 — home / dashboard
 *   variant="compact"  → text-lg (18px) + mb-4 — drawers, sub-pages
 *
 * 2026-05-05 brand pulse:
 *   - h1 set in Newsreader (font-serif) → "document weight" instead of
 *     generic SaaS Inter. Subtitle stays in Inter for legibility at
 *     small sizes.
 *   - flex-wrap on the actions row so the Open-year pill no longer
 *     overlaps the title at narrow viewports (Diego's Tax-Ops bug).
 */
type Variant = 'default' | 'hero' | 'compact';

const TITLE_CLASS: Record<Variant, string> = {
  default: 'text-xl',
  hero:    'text-2xl',
  compact: 'text-lg',
};

const WRAPPER_CLASS: Record<Variant, string> = {
  default: 'mb-6',
  hero:    'mb-8',
  compact: 'mb-4',
};

export function PageHeader({
  title, subtitle, actions, breadcrumb, variant = 'default',
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  breadcrumb?: ReactNode;
  variant?: Variant;
}) {
  return (
    <header className={WRAPPER_CLASS[variant]}>
      {breadcrumb && (
        <div className="text-xs text-ink-muted mb-1.5">{breadcrumb}</div>
      )}
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <h1
            className={[
              TITLE_CLASS[variant],
              'font-serif font-medium tracking-tight text-ink',
            ].join(' ')}
            style={{ letterSpacing: '-0.015em' }}
          >
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-ink-muted mt-1.5 max-w-2xl">{subtitle}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </header>
  );
}
