import type { ReactNode } from 'react';

type Tone =
  | 'neutral' | 'brand' | 'info' | 'success' | 'warning' | 'danger'
  | 'violet'  | 'teal'  | 'amber' | 'indigo' | 'fuchsia' | 'sky';

type Size = 'xs' | 'sm';

const TONE: Record<Tone, string> = {
  neutral: 'bg-surface-alt text-ink-soft border-border',
  brand:   'bg-brand-50 text-brand-700 border-brand-200',
  info:    'bg-info-50 text-info-700 border-[#C9DBF5]',
  success: 'bg-success-50 text-success-700 border-[#B7E7D2]',
  warning: 'bg-warning-50 text-warning-700 border-[#F3D98C]',
  danger:  'bg-danger-50 text-danger-700 border-[#F4B9B7]',
  violet:  'bg-[#F3EEFD] text-[#6A39B5] border-[#E1D3F7]',
  teal:    'bg-[#E3F7F3] text-[#146B5B] border-[#B5E4D8]',
  amber:   'bg-[#FEF3CC] text-[#8A5B00] border-[#F6DC8C]',
  indigo:  'bg-[#EBEFFE] text-[#3949AB] border-[#C9D3F8]',
  fuchsia: 'bg-[#FCEBF5] text-[#9C2A7B] border-[#F4C1E0]',
  sky:     'bg-[#E6F3FB] text-[#0E6CA8] border-[#B9DCF2]',
};

const SIZE: Record<Size, string> = {
  xs: 'text-[10px] px-1.5 py-0.5 rounded-[4px] gap-1',
  sm: 'text-[11px] px-2 py-0.5 rounded-[5px] gap-1',
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
