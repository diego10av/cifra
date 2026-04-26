import type { ReactNode } from 'react';

/**
 * Badge — uppercase status / category chip.
 *
 * Stint 45.F1.5: dropped the 12 hex literals (`border-[#E1D3F7]` etc.)
 * that were silently bypassing the design-token system. Semantic tones
 * (info/success/warning/danger) now use the same border/bg pair as the
 * rest of the codebase. Custom tones (violet/teal/amber/indigo/fuchsia/
 * sky) ride on Tailwind 4's built-in palette — no per-shade hex needed.
 */
type Tone =
  | 'neutral' | 'brand' | 'info' | 'success' | 'warning' | 'danger'
  | 'violet'  | 'teal'  | 'amber' | 'indigo' | 'fuchsia' | 'sky';

type Size = 'xs' | 'sm';

const TONE: Record<Tone, string> = {
  neutral: 'bg-surface-alt text-ink-soft border-border',
  brand:   'bg-brand-50 text-brand-700 border-brand-200',
  info:    'bg-info-50 text-info-700 border-info-50',
  success: 'bg-success-50 text-success-700 border-success-50',
  warning: 'bg-warning-50 text-warning-700 border-warning-50',
  danger:  'bg-danger-50 text-danger-700 border-danger-50',
  // Custom tones use Tailwind 4's stock palette (no extra tokens needed).
  // Border at -200 / bg at -100 / text at -700 keeps the pattern uniform.
  violet:  'bg-violet-100 text-violet-700 border-violet-200',
  teal:    'bg-teal-100 text-teal-700 border-teal-200',
  amber:   'bg-amber-100 text-amber-800 border-amber-200',
  indigo:  'bg-indigo-100 text-indigo-700 border-indigo-200',
  fuchsia: 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200',
  sky:     'bg-sky-100 text-sky-700 border-sky-200',
};

const SIZE: Record<Size, string> = {
  xs: 'text-2xs px-1.5 py-0.5 rounded-sm gap-1',
  sm: 'text-xs px-2 py-0.5 rounded gap-1',
};

export function Badge({
  tone = 'neutral', size = 'xs', children, icon,
  className = '',
}: {
  tone?: Tone; size?: Size; children: ReactNode; icon?: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={[
        'inline-flex items-center border font-semibold tracking-wide uppercase',
        TONE[tone], SIZE[size], className,
      ].join(' ')}
    >
      {icon}
      {children}
    </span>
  );
}
