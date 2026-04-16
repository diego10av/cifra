import type { HTMLAttributes, ReactNode } from 'react';

export function Card({ className = '', children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`bg-surface border border-border rounded-lg shadow-xs ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title, subtitle, right, className = '',
}: {
  title: ReactNode; subtitle?: ReactNode; right?: ReactNode; className?: string;
}) {
  return (
    <div className={`px-4 py-3 border-b border-divider flex items-center justify-between gap-3 ${className}`}>
      <div className="min-w-0">
        <h3 className="text-[13px] font-semibold text-ink tracking-tight">{title}</h3>
        {subtitle && <p className="text-[11.5px] text-ink-muted mt-0.5">{subtitle}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

export function CardBody({ className = '', children }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`p-4 ${className}`}>{children}</div>;
}
