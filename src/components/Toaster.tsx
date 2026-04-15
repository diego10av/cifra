'use client';

import { useEffect, useState, createContext, useContext, useCallback } from 'react';

export type ToastKind = 'success' | 'error' | 'info';
export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  hint?: string;
}

interface ToastContextValue {
  push: (t: Omit<Toast, 'id'>) => void;
  success: (message: string, hint?: string) => void;
  error: (message: string, hint?: string) => void;
  info: (message: string, hint?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Safe no-op fallback for places that render outside the provider
    return {
      push: () => {},
      success: () => {},
      error: () => {},
      info: () => {},
    };
  }
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => {
    setToasts(ts => ts.filter(t => t.id !== id));
  }, []);

  const push = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random();
    setToasts(ts => [...ts, { id, ...t }]);
    const lifetime = t.kind === 'error' ? 8000 : 3500;
    setTimeout(() => remove(id), lifetime);
  }, [remove]);

  const value: ToastContextValue = {
    push,
    success: (m, h) => push({ kind: 'success', message: m, hint: h }),
    error: (m, h) => push({ kind: 'error', message: m, hint: h }),
    info: (m, h) => push({ kind: 'info', message: m, hint: h }),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastRack toasts={toasts} onDismiss={remove} />
    </ToastContext.Provider>
  );
}

function ToastRack({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 items-end max-w-[380px]">
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

  const palette = toast.kind === 'success'
    ? 'bg-white border-emerald-200 text-emerald-900'
    : toast.kind === 'error'
      ? 'bg-white border-red-200 text-red-900'
      : 'bg-white border-gray-200 text-gray-900';
  const iconColor = toast.kind === 'success' ? 'text-emerald-600' : toast.kind === 'error' ? 'text-red-600' : 'text-gray-500';

  return (
    <div
      className={`${palette} border rounded-lg shadow-lg px-3 py-2.5 text-[12px] flex items-start gap-2.5 transition-all duration-150`}
      style={{
        opacity: entering ? 0 : 1,
        transform: entering ? 'translateY(6px)' : 'translateY(0)',
        minWidth: 260,
      }}
    >
      <div className={`shrink-0 ${iconColor}`}>
        {toast.kind === 'success' && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>}
        {toast.kind === 'error' && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
        {toast.kind === 'info' && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium leading-snug">{toast.message}</div>
        {toast.hint && <div className="text-[11px] text-gray-500 mt-0.5">{toast.hint}</div>}
      </div>
      <button onClick={onDismiss} className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer -mr-1" aria-label="Dismiss">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  );
}
