import type { ReactNode } from 'react';

export function EmptyState({
  icon, title, description, action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6">
      {icon && (
        <div className="w-12 h-12 rounded-full bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-500 mb-4">
          {icon}
        </div>
      )}
      <h3 className="text-[14px] font-semibold text-ink tracking-tight">{title}</h3>
      {description && (
        <p className="text-[12.5px] text-ink-muted mt-1.5 max-w-sm">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
