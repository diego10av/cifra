'use client';

import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, type ReactNode } from 'react';

const BASE =
  'w-full bg-surface border border-border rounded-md px-3 py-1.5 text-[12.5px] text-ink ' +
  'placeholder:text-ink-faint ' +
  'transition-colors duration-150 ' +
  'hover:border-border-strong ' +
  'focus:border-brand-500 focus:outline-none focus-visible:shadow-focus ' +
  'disabled:opacity-50 disabled:cursor-not-allowed';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = '', ...rest }, ref) {
    return <input ref={ref} className={`${BASE} ${className}`} {...rest} />;
  }
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className = '', ...rest }, ref) {
    return <textarea ref={ref} className={`${BASE} ${className}`} {...rest} />;
  }
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className = '', children, ...rest }, ref) {
    return (
      <select ref={ref} className={`${BASE} appearance-none pr-7 ${className}`} {...rest}>
        {children}
      </select>
    );
  }
);

export function Label({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <label className={`block text-[11px] uppercase tracking-[0.04em] font-semibold text-ink-muted mb-1.5 ${className}`}>
      {children}
    </label>
  );
}

export function Field({
  label, hint, children, className = '',
}: {
  label?: ReactNode; hint?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <div className={className}>
      {label && <Label>{label}</Label>}
      {children}
      {hint && <p className="text-[11px] text-ink-muted mt-1">{hint}</p>}
    </div>
  );
}
