'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
}

const VARIANT: Record<Variant, string> = {
  primary:   'bg-brand-500 text-white hover:bg-brand-600 active:bg-brand-700 shadow-xs',
  secondary: 'bg-surface text-ink border border-border hover:bg-surface-alt hover:border-border-strong',
  ghost:     'bg-transparent text-ink-soft hover:bg-surface-alt',
  danger:    'bg-danger-500 text-white hover:bg-danger-700 active:bg-danger-700',
  success:   'bg-success-500 text-white hover:bg-success-700 active:bg-success-700',
};

const SIZE: Record<Size, string> = {
  sm: 'h-7  px-2.5 text-[11.5px] gap-1.5',
  md: 'h-8  px-3   text-[12.5px] gap-1.5',
  lg: 'h-9  px-4   text-[13.5px] gap-2',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, icon, iconRight, children, className = '', disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={[
        'inline-flex items-center justify-center rounded-md font-medium',
        'transition-all duration-150',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        'focus-visible:outline-none',
        VARIANT[variant],
        SIZE[size],
        className,
      ].join(' ')}
      {...rest}
    >
      {loading ? <Spinner /> : icon}
      {children}
      {iconRight && !loading && iconRight}
    </button>
  );
});

function Spinner() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
