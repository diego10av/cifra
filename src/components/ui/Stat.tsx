import type { ReactNode } from 'react';

type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'muted';

const TONE: Record<Tone, string> = {
  neutral: 'text-ink',
  brand:   'text-brand-600',
  success: 'text-success-700',
  warning: 'text-warning-700',
  danger:  'text-danger-700',
  info:    'text-info-700',
  muted:   'text-ink-muted',
};

export function Stat({
  label, value, subtitle, tone = 'neutral', size = 'md',
}: {
  label: string;
  value: ReactNode;
  subtitle?: ReactNode;
  tone?: Tone;
  size?: 'sm' | 'md' | 'lg';
}) {
  const valueSize =
    size === 'lg' ? 'text-[26px]' :
    size === 'sm' ? 'text-[16px]' : 'text-[22px]';
  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      <div className="text-[10.5px] uppercase tracking-[0.06em] font-semibold text-ink-muted">
        {label}
      </div>
      <div className={`font-bold mt-1.5 tabular-nums tracking-tight ${valueSize} ${TONE[tone]}`}>
        {value}
      </div>
      {subtitle && (
        <div className="text-[11.5px] text-ink-muted mt-1">{subtitle}</div>
      )}
    </div>
  );
}
