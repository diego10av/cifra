'use client';

// ════════════════════════════════════════════════════════════════════════
// Toast rack with dedup + soft cap.
//
// Stint 12 upgrades:
//   - Identical message+kind within 3 s → increment a "×N" counter on
//     the existing toast instead of adding another. Prevents a burst
//     of network errors from pushing 10 copies onto the screen.
//   - Soft cap at 6 visible toasts. Oldest fades out when the cap is hit.
//   - Keyboard: ESC dismisses the most recent toast.
//   - Slight enter animation per toast; stack order is newest-on-top.
// ════════════════════════════════════════════════════════════════════════

import { useEffect, useState, createContext, useContext, useCallback, useRef } from 'react';

export type ToastKind = 'success' | 'error' | 'info';
/** Inline action button rendered inside a toast (e.g. "Undo" after delete).
 *  When an action is present, the toast's lifetime is extended so the user
 *  has a realistic window to click it. */
export interface ToastAction {
  label: string;
  onClick: () => void | Promise<void>;
}
export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  hint?: string;
  action?: ToastAction;
  /** How many times this same message was pushed within the dedup window. */
  count: number;
  /** Timestamp of the last push — used to extend lifetime on re-occurrence. */
  lastAt: number;
}

interface ToastContextValue {
  push: (t: Omit<Toast, 'id' | 'count' | 'lastAt'>) => void;
  success: (message: string, hint?: string) => void;
  error: (message: string, hint?: string) => void;
  info: (message: string, hint?: string) => void;
  withAction: (kind: ToastKind, message: string, hint: string | undefined, action: ToastAction) => void;
  clearAll: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEDUP_WINDOW_MS = 3000;
const MAX_VISIBLE = 6;
const LIFETIME_BY_KIND: Record<ToastKind, number> = {
  success: 3500,
  info: 4000,
  error: 8000,
};

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Safe no-op fallback for places that render outside the provider
    return {
      push: () => {},
      success: () => {},
      error: () => {},
      info: () => {},
      withAction: () => {},
      clearAll: () => {},
    };
  }
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  // Use a ref to own the expiry timers so dedup can extend them without
  // leaking.
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const remove = useCallback((id: number) => {
    const timer = timersRef.current.get(id);
    if (timer) { clearTimeout(timer); timersRef.current.delete(id); }
    setToasts(ts => ts.filter(t => t.id !== id));
  }, []);

  const scheduleExpiry = useCallback((id: number, kind: ToastKind, hasAction: boolean) => {
    const existing = timersRef.current.get(id);
    if (existing) clearTimeout(existing);
    // Toasts with an inline action (e.g. Undo) get a 5-second window
    // regardless of kind — generous enough to read + click, but not so
    // long that a stack of undo-toasts clutters the screen.
    const lifetime = hasAction ? 5000 : LIFETIME_BY_KIND[kind];
    const t = setTimeout(() => remove(id), lifetime);
    timersRef.current.set(id, t);
  }, [remove]);

  const push = useCallback((t: Omit<Toast, 'id' | 'count' | 'lastAt'>) => {
    const now = Date.now();
    setToasts(prev => {
      // Dedup: identical kind + message + hint within DEDUP_WINDOW_MS.
      const dupIdx = prev.findIndex(x =>
        x.kind === t.kind && x.message === t.message && (x.hint ?? '') === (t.hint ?? '')
        && now - x.lastAt < DEDUP_WINDOW_MS,
      );
      if (dupIdx !== -1) {
        const updated = [...prev];
        const existing = updated[dupIdx];
        updated[dupIdx] = { ...existing, count: existing.count + 1, lastAt: now };
        scheduleExpiry(existing.id, existing.kind, !!existing.action);
        return updated;
      }

      // New toast. Enforce the max-visible cap — drop oldest first.
      const id = now + Math.random();
      const next = [...prev, { id, ...t, count: 1, lastAt: now }];
      while (next.length > MAX_VISIBLE) {
        const drop = next.shift()!;
        const timer = timersRef.current.get(drop.id);
        if (timer) { clearTimeout(timer); timersRef.current.delete(drop.id); }
      }
      scheduleExpiry(id, t.kind, !!t.action);
      return next;
    });
  }, [scheduleExpiry]);

  const clearAll = useCallback(() => {
    for (const timer of timersRef.current.values()) clearTimeout(timer);
    timersRef.current.clear();
    setToasts([]);
  }, []);

  // ESC dismisses the most-recent toast.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && toasts.length > 0) {
        const last = toasts[toasts.length - 1];
        remove(last.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toasts, remove]);

  const value: ToastContextValue = {
    push,
    success: (m, h) => push({ kind: 'success', message: m, hint: h }),
    error: (m, h) => push({ kind: 'error', message: m, hint: h }),
    info: (m, h) => push({ kind: 'info', message: m, hint: h }),
    withAction: (kind, m, h, action) => push({ kind, message: m, hint: h, action }),
    clearAll,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastRack toasts={toasts} onDismiss={remove} onClearAll={clearAll} />
    </ToastContext.Provider>
  );
}

function ToastRack({
  toasts, onDismiss, onClearAll,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
  onClearAll: () => void;
}) {
  return (
    <div
      className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 items-end max-w-[420px]"
      role="region"
      aria-label="Notifications"
    >
      {toasts.length >= 3 && (
        <button
          onClick={onClearAll}
          className="text-[10.5px] text-ink-muted bg-white border border-border rounded-md px-2 py-1 shadow-sm hover:text-ink"
        >
          Clear all ({toasts.length})
        </button>
      )}
      {toasts.map(t => <ToastItem key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />)}
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const [entering, setEntering] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setEntering(false), 10);
    return () => clearTimeout(t);
  }, []);

  // Stint 45.F1.5 — palette pulled from design tokens (--color-success-*,
  // --color-danger-*, --color-info-*) so the toast green matches the
  // success badge green and the brand stays in sync if the palette shifts.
  const palette = toast.kind === 'success'
    ? 'bg-surface border-success-50 text-success-700'
    : toast.kind === 'error'
      ? 'bg-surface border-danger-50 text-danger-700'
      : 'bg-surface border-info-50 text-ink';
  const iconColor = toast.kind === 'success'
    ? 'text-success-500'
    : toast.kind === 'error'
      ? 'text-danger-500'
      : 'text-ink-muted';

  return (
    <div
      className={`${palette} border rounded-lg shadow-lg px-3 py-2.5 text-sm flex items-start gap-2.5 transition-all duration-150`}
      style={{
        opacity: entering ? 0 : 1,
        transform: entering ? 'translateY(6px)' : 'translateY(0)',
        minWidth: 280,
      }}
      role={toast.kind === 'error' ? 'alert' : 'status'}
    >
      <div className={`shrink-0 ${iconColor} pt-0.5`}>
        {toast.kind === 'success' && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>}
        {toast.kind === 'error' && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
        {toast.kind === 'info' && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium leading-snug flex items-center gap-1.5">
          <span>{toast.message}</span>
          {toast.count > 1 && (
            <span className="inline-flex items-center justify-center h-[16px] min-w-[20px] px-1 text-2xs font-bold tabular-nums bg-ink text-white rounded-full">
              ×{toast.count}
            </span>
          )}
        </div>
        {toast.hint && <div className="text-xs text-ink-muted mt-0.5">{toast.hint}</div>}
      </div>
      {toast.action && (
        <button
          onClick={async () => {
            // Dismiss first so a slow handler doesn't leave the toast
            // dangling — the action is considered "committed" once the
            // user has clicked.
            onDismiss();
            try { await toast.action!.onClick(); } catch { /* swallow */ }
          }}
          className="shrink-0 h-7 px-2.5 text-xs font-semibold text-brand-700 hover:text-brand-900 border border-brand-300 rounded-md hover:bg-brand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          {toast.action.label}
        </button>
      )}
      <button
        onClick={onDismiss}
        className="shrink-0 text-ink-faint hover:text-ink-muted transition-colors cursor-pointer -mr-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink rounded"
        aria-label="Dismiss notification"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  );
}
