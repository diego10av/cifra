'use client';

// CrmContextMenu — generic right-click menu for CRM list rows.
//
// Stint 63.C (2026-04-28). Ports the TaskContextMenu pattern from
// Tax-Ops, but generalised: instead of task-specific actions hardcoded
// inside the component, the call site passes an `actions[]` array. So
// the same component serves companies, contacts, opportunities,
// matters — each with their own action set.
//
// Lifecycle: rendered conditionally by the parent based on `{x, y,
// title, actions}` state. ESC + click outside close. Each action click
// dispatches the handler and then auto-closes.

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { LucideIcon } from 'lucide-react';

export interface CrmContextAction {
  label: string;
  icon?: LucideIcon;
  /** Renders the row in danger styling (red text, danger hover). */
  danger?: boolean;
  /** Disables the action visually + functionally. */
  disabled?: boolean;
  /** Inserts a horizontal divider BEFORE this action. */
  separatorBefore?: boolean;
  onClick: () => void | Promise<void>;
}

interface Props {
  title: string;       // shown truncated as the menu header
  x: number;
  y: number;
  actions: CrmContextAction[];
  onClose: () => void;
}

export function CrmContextMenu({ title, x, y, actions, onClose }: Props) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    }
    function handleClick() { onClose(); }
    document.addEventListener('keydown', handleKey);
    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [onClose]);

  // Clamp inside viewport so the menu never escapes the right/bottom
  // edges of the window. The 220×280 reservation is conservative; real
  // sizes vary with action count.
  const top = Math.min(y, typeof window !== 'undefined' ? window.innerHeight - 280 : y);
  const left = Math.min(x, typeof window !== 'undefined' ? window.innerWidth - 220 : x);

  return createPortal(
    <div
      onMouseDown={(e) => e.stopPropagation()}
      style={{ position: 'fixed', top, left }}
      className="z-popover w-[210px] bg-surface border border-border rounded-md shadow-lg py-1 text-sm"
      role="menu"
    >
      <div className="px-3 py-1 text-2xs text-ink-muted truncate" title={title}>
        {title}
      </div>
      <div className="border-t border-border my-0.5" />
      {actions.map((action, i) => {
        const Icon = action.icon;
        return (
          <span key={i}>
            {action.separatorBefore && <div className="border-t border-border my-0.5" />}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                if (action.disabled) return;
                void action.onClick();
                onClose();
              }}
              disabled={action.disabled}
              className={[
                'w-full text-left px-3 py-1 inline-flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed',
                action.danger
                  ? 'hover:bg-danger-50 text-danger-700'
                  : 'hover:bg-surface-alt',
              ].join(' ')}
            >
              {Icon && <Icon size={11} />}
              {action.label}
            </button>
          </span>
        );
      })}
    </div>,
    document.body,
  );
}
