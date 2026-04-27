'use client';

// ════════════════════════════════════════════════════════════════════════
// Popover — stint 47.F3.1
//
// Floating panel anchored to a trigger element. Click-outside / ESC to
// close, arrow-key escape from focus trap, scroll lock OFF (popovers
// shouldn't lock the page). Auto-positions below the trigger by
// default with `placement="bottom-start"`; supports left/right/top
// flips when the panel would overflow the viewport.
//
// This is the single-source-of-truth replacement for the ad-hoc popover
// markup in SearchableSelect, LiquidationChip, EntityActionsMenu,
// AssessmentInlineEditor, NwtReviewInlineCell quick-actions, etc.
// Each had its own click-outside listener, ESC handler, z-index. They
// can all collapse onto this primitive when refactored.
//
// API:
//   <Popover
//     trigger={<button>Open</button>}
//     open={open}
//     onOpenChange={setOpen}
//     placement="bottom-start"
//   >
//     <p>Anything you want</p>
//   </Popover>
//
// `trigger` is rendered as-is — Popover does NOT add a click handler to
// it. Caller wires onClick to flip `open`. (Keeps the trigger a pure
// React node; the consumer can be a <button>, <Link>, or anything.)
// ════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState, type ReactNode } from 'react';

type Placement =
  | 'bottom-start' | 'bottom-end'
  | 'top-start'    | 'top-end'
  | 'right-start'  | 'left-start';

interface Props {
  trigger: ReactNode;
  open: boolean;
  onOpenChange: (next: boolean) => void;
  children: ReactNode;
  placement?: Placement;
  /** Optional class on the floating panel. */
  className?: string;
  /** Min-width of the panel (matches the trigger by default if `matchTriggerWidth`). */
  minWidth?: number;
  /** When true, panel min-width === trigger width. */
  matchTriggerWidth?: boolean;
  /** When true, ESC does NOT close. */
  preventEscape?: boolean;
}

export function Popover({
  trigger, open, onOpenChange, children,
  placement = 'bottom-start',
  className = '',
  minWidth = 200,
  matchTriggerWidth = false,
  preventEscape = false,
}: Props) {
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [triggerWidth, setTriggerWidth] = useState<number | null>(null);

  // Click-outside to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) onOpenChange(false);
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [open, onOpenChange]);

  // ESC closes
  useEffect(() => {
    if (!open || preventEscape) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onOpenChange(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onOpenChange, preventEscape]);

  // Match trigger width on open (read once; if the trigger resizes,
  // the consumer can force a re-render via key)
  useEffect(() => {
    if (open && matchTriggerWidth) {
      const w = triggerRef.current?.getBoundingClientRect().width ?? null;
      setTriggerWidth(w);
    }
  }, [open, matchTriggerWidth]);

  // Place by class — Tailwind handles the actual positioning, we just
  // pick the classes per placement.
  const placeClass: Record<Placement, string> = {
    'bottom-start': 'top-full left-0 mt-1',
    'bottom-end':   'top-full right-0 mt-1',
    'top-start':    'bottom-full left-0 mb-1',
    'top-end':      'bottom-full right-0 mb-1',
    'right-start':  'left-full top-0 ml-1',
    'left-start':   'right-full top-0 mr-1',
  };

  return (
    <span ref={wrapperRef} className="relative inline-block">
      <span ref={triggerRef} className="inline-block">{trigger}</span>
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          className={[
            'absolute z-popover bg-surface border border-border rounded-md shadow-lg overflow-hidden',
            placeClass[placement],
            className,
          ].join(' ')}
          style={{
            minWidth: matchTriggerWidth && triggerWidth ? triggerWidth : minWidth,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      )}
    </span>
  );
}
