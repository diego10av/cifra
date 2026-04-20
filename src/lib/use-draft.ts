'use client';

// ════════════════════════════════════════════════════════════════════════
// useDraft — drop-in localStorage persistence for in-progress form state.
//
// Stint 12 (2026-04-20): Gassner audit follow-up #1. Reviewers
// routinely start filling a client/entity profile + get pulled away.
// Closing the tab today wipes everything. useDraft keeps a JSON
// snapshot in localStorage (debounced 250 ms) so re-opening the form
// restores it. On a successful save (`clear()`), the draft is purged.
//
// Contract:
//   const [value, setValue, { hasDraft, clear, lastSavedAt }] =
//     useDraft<MyShape>('key', initialValue);
//
// Key advice: include a stable identity in the key so each entity /
// client has its own draft slot (e.g. `entity-edit:${entityId}`).
// ════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from 'react';

const PREFIX = 'cifra_draft:';
const DEBOUNCE_MS = 250;

export interface DraftMeta {
  hasDraft: boolean;
  clear: () => void;
  lastSavedAt: number | null;
}

export function useDraft<T>(
  key: string,
  initial: T,
): [T, (v: T | ((prev: T) => T)) => void, DraftMeta] {
  const storageKey = PREFIX + key;

  // On first render, try to read the saved draft. SSR-safe: falls back to
  // `initial` when window is unavailable.
  const [value, setValueState] = useState<T>(() => {
    if (typeof window === 'undefined') return initial;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as { v: T };
        return parsed.v;
      }
    } catch { /* ignore parse errors */ }
    return initial;
  });

  const [lastSavedAt, setLastSavedAt] = useState<number | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) return (JSON.parse(raw) as { t?: number }).t ?? null;
    } catch { /* noop */ }
    return null;
  });

  const [hasDraft, setHasDraft] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return !!window.localStorage.getItem(storageKey);
  });

  // Debounced writer.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persist = useCallback((next: T) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      try {
        const t = Date.now();
        window.localStorage.setItem(storageKey, JSON.stringify({ v: next, t }));
        setLastSavedAt(t);
        setHasDraft(true);
      } catch { /* quota / private mode */ }
    }, DEBOUNCE_MS);
  }, [storageKey]);

  const setValue = useCallback((next: T | ((prev: T) => T)) => {
    setValueState(prev => {
      const computed = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
      persist(computed);
      return computed;
    });
  }, [persist]);

  const clear = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    try { window.localStorage.removeItem(storageKey); } catch { /* noop */ }
    setLastSavedAt(null);
    setHasDraft(false);
  }, [storageKey]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return [value, setValue, { hasDraft, clear, lastSavedAt }];
}

/**
 * Utility for purging ALL drafts under the cifra_draft: prefix. Useful
 * on logout and when we want to clear stale state during a role swap.
 */
export function purgeAllDrafts(): void {
  try {
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(PREFIX)) window.localStorage.removeItem(k);
    }
  } catch { /* noop */ }
}
