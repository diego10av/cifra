import type { ReactNode } from 'react';

export function PageHeader({
  title, subtitle, actions, breadcrumb,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  breadcrumb?: ReactNode;
}) {
  return (
    <header className="mb-6">
      {breadcrumb && (
        <div className="text-[11px] text-ink-muted mb-1.5">{breadcrumb}</div>
      )}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold tracking-tight text-ink" style={{ letterSpacing: '-0.015em' }}>
            {title}
          </h1>
          {subtitle && (
            <p className="text-[12.5px] text-ink-muted mt-1.5 max-w-2xl">{subtitle}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </header>
  );
}
