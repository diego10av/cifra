import type { ReactNode } from 'react';

/**
 * PageContainer — canonical width + horizontal padding for every page.
 *
 * Stint 45.F1.3: removes the inconsistency between max-w-[1200px],
 * max-w-5xl, and full-width pages. Defaults to `wide` (1280px) which
 * comfortably hosts an 11-column tax-ops matrix while keeping margins.
 *
 *   width="wide"   → max-w-7xl (1280px) — matrix pages, dashboards (canonical)
 *   width="medium" → max-w-5xl (1024px) — list pages, declarations
 *   width="narrow" → max-w-3xl (768px)  — forms, settings, prose
 *   width="full"   → no cap             — escape hatch for edge cases
 *
 * Always centres the content horizontally and pads `px-4 sm:px-6` on
 * the sides so contents don't kiss the viewport edge on narrow desktops.
 */
type Width = 'wide' | 'medium' | 'narrow' | 'full';

const WIDTH_CLASS: Record<Width, string> = {
  wide:   'max-w-7xl',
  medium: 'max-w-5xl',
  narrow: 'max-w-3xl',
  full:   '',
};

export function PageContainer({
  width = 'wide',
  children,
  className,
}: {
  width?: Width;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={['mx-auto px-4 sm:px-6', WIDTH_CLASS[width], className ?? ''].join(' ').trim()}>
      {children}
    </div>
  );
}
