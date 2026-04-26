import type { ReactNode } from 'react';

/**
 * PageHeader — canonical title row for every page.
 *
 * Stint 45.F1.2: added `variant` so home/dashboard pages can render a
 * larger hero title (text-2xl) without rolling their own header. Internal
 * list/detail pages stay on the standard text-xl. Compact is for dense
 * contexts (drawers, settings sub-pages).
 *
 *   variant="default"  → text-xl (22px) + mb-6 — internal pages (canonical)
 *   variant="hero"     → text-2xl (26px) + mb-8 — home / dashboard
 *   variant="compact"  → text-lg (18px) + mb-4 — drawers, sub-pages
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
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1
            className={[TITLE_CLASS[variant], 'font-semibold tracking-tight text-ink'].join(' ')}
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
