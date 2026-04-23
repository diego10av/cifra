'use client';

// ════════════════════════════════════════════════════════════════════════
// OverflowMenu — reusable 3-dot menu for low-frequency nav items.
// Keeps the primary tab bar lean while preserving access. Used in
// /crm/layout.tsx to collapse Trash / Settings / Help out of the
// always-visible bar.
// ════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { MoreHorizontalIcon } from 'lucide-react';

export interface OverflowItem {
  href: string;
  label: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
}

export function OverflowMenu({
  items,
  ariaLabel = 'More',
}: {
  items: OverflowItem[];
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click + Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center justify-center h-[28px] w-[28px] text-ink-muted hover:text-ink border border-border rounded-md hover:bg-surface-alt"
      >
        <MoreHorizontalIcon size={14} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[34px] z-40 min-w-[180px] bg-white border border-border rounded-md shadow-lg py-1"
        >
          {items.map(it => {
            const Icon = it.icon;
            return (
              <Link
                key={it.href}
                href={it.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-3 py-1.5 text-[12.5px] text-ink-soft hover:bg-surface-alt hover:text-ink"
              >
                {Icon && <Icon size={13} className="text-ink-muted" />}
                {it.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
