'use client';

// Linear / Factorial-style horizontal tabs. The active tab gets a 2px
// brand-pink underline. Tabs can carry an inline count badge.

import type { ReactNode } from 'react';

export interface TabDef {
  id: string;
  label: string;
  icon?: ReactNode;
  badge?: number;
  badgeTone?: 'brand' | 'warning' | 'neutral';
}

export function Tabs({
  tabs, activeId, onChange,
}: {
  tabs: TabDef[];
  activeId: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="border-b border-border">
      <div role="tablist" className="flex items-center gap-1 -mb-px overflow-x-auto">
        {tabs.map(tab => {
          const isActive = tab.id === activeId;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(tab.id)}
              className={[
                'group inline-flex items-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors',
                'border-b-2 -mb-px whitespace-nowrap',
                isActive
                  ? 'border-brand-500 text-ink'
                  : 'border-transparent text-ink-muted hover:text-ink-soft hover:border-border-strong',
              ].join(' ')}
            >
              {tab.icon && (
                <span className={isActive ? 'text-brand-500' : 'text-ink-muted group-hover:text-ink-soft'}>
                  {tab.icon}
                </span>
              )}
              <span>{tab.label}</span>
              {typeof tab.badge === 'number' && tab.badge > 0 && (
                <span
                  className={[
                    'tabular-nums inline-flex items-center justify-center',
                    'min-w-[18px] h-[18px] px-1 rounded-full text-2xs font-semibold border',
                    tab.badgeTone === 'warning'
                      ? 'bg-brand-50 text-brand-700 border-brand-100'
                      : tab.badgeTone === 'neutral'
                        ? 'bg-surface-alt text-ink-muted border-border'
                        : isActive
                          ? 'bg-brand-500 text-white border-brand-500'
                          : 'bg-brand-50 text-brand-700 border-brand-100',
                  ].join(' ')}
                >
                  {tab.badge > 99 ? '99+' : tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Small helper: render only the active panel. Use when the tab panels
 * are cheap; otherwise handle conditional rendering at the call site.
 */
export function TabPanel({
  id, activeId, children,
}: {
  id: string; activeId: string; children: ReactNode;
}) {
  if (id !== activeId) return null;
  return <div role="tabpanel">{children}</div>;
}
