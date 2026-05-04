'use client';

// ════════════════════════════════════════════════════════════════════════
// useListState — shared hook for URL-synced filters + sort + pagination.
//
// Factored out of the declarations page refactor so clients + entities
// can use the same primitive with one-liner wire-up. Scope:
//
//   - free-text search (q)
//   - single-value filter string (e.g. status, vat_filter)
//   - sort key + direction
//   - page + page size (with fixed options)
//   - URL round-trip via router.replace (no scroll)
//
// The hook is agnostic about what you're sorting — pass a compare
// function to `applySort` on the consuming side.
// ════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export type SortDir = 'asc' | 'desc';

export interface ListStateOptions<SK extends string, F extends string> {
  /** Base path for URL sync, e.g. '/entities'. */
  basePath: string;
  /** Allowed sort keys + the default. */
  sortKeys: readonly SK[];
  defaultSort: SK;
  defaultDir?: SortDir;
  /** Allowed filter values + the default. */
  filterValues: readonly F[];
  defaultFilter: F;
  /** Permitted page sizes. The hook clamps `size` to one of these. */
  pageSizes: readonly number[];
  defaultPageSize: number;
  /** Additional non-interactive query params to preserve in the URL
   *  (e.g. entity_id on /declarations). */
  passthroughParams?: readonly string[];
}

export interface ListState<SK extends string, F extends string> {
  q: string;
  setQ: (v: string) => void;
  filter: F;
  setFilter: (v: F) => void;
  sort: SK;
  dir: SortDir;
  toggleSort: (key: SK) => void;
  page: number;
  setPage: (v: number | ((prev: number) => number)) => void;
  pageSize: number;
  setPageSize: (v: number) => void;
}

export function useListState<SK extends string, F extends string>(
  opts: ListStateOptions<SK, F>,
): ListState<SK, F> {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Stint 67.A.b — initial state uses defaults; URL params are read in
  // an effect AFTER mount (below). Reading `searchParams.get(...)`
  // synchronously during render was forcing the parent <Suspense>
  // boundary into its fallback under Next.js 16 + React 19, and the
  // streamed HTML's `<!--$~-->` placeholder never resolved client-side
  // — the page hung forever on the skeleton even though the API
  // returned 200 OK. Pages that don't go through this hook
  // (/declarations) read searchParams the same way without breaking,
  // but /clients + /entities (which DO use the hook) stuck.
  // Defer-until-effect sidesteps the boundary entirely.

  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<F>(opts.defaultFilter);
  const [sort, setSort] = useState<SK>(opts.defaultSort);
  const [dir, setDir] = useState<SortDir>(opts.defaultDir ?? 'desc');
  const [page, setPageRaw] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(opts.defaultPageSize);

  // Initialize from URL params after mount.
  const hasReadUrl = useRef(false);
  useEffect(() => {
    if (hasReadUrl.current) return;
    hasReadUrl.current = true;
    const initialQ = searchParams.get('q') ?? '';
    const initialFilter = readEnum<F>(searchParams.get('filter'), opts.filterValues, opts.defaultFilter);
    const initialSort = readEnum<SK>(searchParams.get('sort'), opts.sortKeys, opts.defaultSort);
    const initialDir: SortDir = (searchParams.get('dir') === 'asc' ? 'asc' : searchParams.get('dir') === 'desc' ? 'desc' : (opts.defaultDir ?? 'desc'));
    const initialPage = Math.max(1, Number(searchParams.get('page')) || 1);
    const initialPageSize = opts.pageSizes.includes(Number(searchParams.get('size')))
      ? Number(searchParams.get('size'))
      : opts.defaultPageSize;
    if (initialQ) setQ(initialQ);
    if (initialFilter !== opts.defaultFilter) setFilter(initialFilter);
    if (initialSort !== opts.defaultSort) setSort(initialSort);
    if (initialDir !== (opts.defaultDir ?? 'desc')) setDir(initialDir);
    if (initialPage !== 1) setPageRaw(initialPage);
    if (initialPageSize !== opts.defaultPageSize) setPageSize(initialPageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setPage = useCallback((v: number | ((p: number) => number)) => {
    setPageRaw(prev => typeof v === 'function' ? (v as (p: number) => number)(prev) : v);
  }, []);

  const toggleSort = useCallback((key: SK) => {
    if (sort === key) {
      setDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSort(key);
      setDir('asc');
    }
  }, [sort]);

  // Reset page 1 when any dimension except page itself changes.
  useEffect(() => { setPageRaw(1); }, [q, filter, sort, dir, pageSize]);

  // URL sync.
  //
  // Stint 67.A — skip the first run (initial mount). The state was
  // just initialized FROM searchParams, so router.replace on mount
  // would write the same URL we read from. In Next.js 16 / React 19
  // that triggers a Suspense reset of the route segment which loops
  // the page back to its `<PageSkeleton />` fallback, and the data-
  // fetch effect never gets a stable mount to run on. Result before
  // the fix: /clients, /entities (both consumers of this hook) hung
  // forever on the skeleton even though their /api/* endpoints
  // returned 200 OK.
  //
  // Skipping the initial run + only writing the URL when a dimension
  // actually changes mirrors how /declarations does it (which never
  // had this bug). The user-visible behaviour is identical: the URL
  // already reflects the initial state because the initial state
  // was read from it.
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    const qs = new URLSearchParams();
    for (const key of opts.passthroughParams ?? []) {
      const v = searchParams.get(key);
      if (v != null) qs.set(key, v);
    }
    if (q.trim()) qs.set('q', q.trim());
    if (filter !== opts.defaultFilter) qs.set('filter', filter);
    if (sort !== opts.defaultSort) qs.set('sort', sort);
    if (dir !== (opts.defaultDir ?? 'desc')) qs.set('dir', dir);
    if (page > 1) qs.set('page', String(page));
    if (pageSize !== opts.defaultPageSize) qs.set('size', String(pageSize));
    const str = qs.toString();
    router.replace(str ? `${opts.basePath}?${str}` : opts.basePath, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, filter, sort, dir, page, pageSize]);

  return { q, setQ, filter, setFilter, sort, dir, toggleSort, page, setPage, pageSize, setPageSize };
}

function readEnum<T extends string>(
  raw: string | null,
  allowed: readonly T[],
  fallback: T,
): T {
  if (raw && (allowed as readonly string[]).includes(raw)) return raw as T;
  return fallback;
}

// ─────────────────── Paginator UI ───────────────────

export function paginate<T>(rows: T[], page: number, pageSize: number) {
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const effectivePage = Math.min(Math.max(1, page), totalPages);
  const start = (effectivePage - 1) * pageSize;
  return {
    total,
    totalPages,
    page: effectivePage,
    start,
    end: Math.min(start + pageSize, total),
    visible: rows.slice(start, start + pageSize),
  };
}
