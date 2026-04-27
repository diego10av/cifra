'use client';

// Stint 57.D.2 — saved task-list views.
//
// Now that filters are URL-persistent (D.1), a "saved view" is just
// a captured query string with a friendly name. Stored locally per
// browser (localStorage) — multi-user persistence can come later if
// needed. Diego configures something like "Mías + ready + due esta
// semana" once, hits Save, and recalls it later from a dropdown.

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { ChevronDownIcon, BookmarkIcon, Trash2Icon } from 'lucide-react';

const STORAGE_KEY = 'cifra.tasks.savedViews.v1';

interface SavedView {
  name: string;
  query: string;       // raw query string, no leading "?"
  created_at: string;
}

function loadAll(): SavedView[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedView[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAll(views: SavedView[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(views));
}

interface Props {
  /** Current query string (live, no leading "?"). Used to "Save current as…". */
  currentQuery: string;
}

export function TaskSavedViews({ currentQuery }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [views, setViews] = useState<SavedView[]>([]);

  useEffect(() => { setViews(loadAll()); }, []);

  function applyView(v: SavedView) {
    setOpen(false);
    router.push(v.query ? `${pathname}?${v.query}` : pathname, { scroll: false });
  }

  function saveCurrent() {
    const name = window.prompt('Name this view:')?.trim();
    if (!name) return;
    if (views.some(v => v.name === name)) {
      if (!window.confirm(`"${name}" already exists. Overwrite?`)) return;
    }
    const next = [
      { name, query: currentQuery, created_at: new Date().toISOString() },
      ...views.filter(v => v.name !== name),
    ];
    setViews(next);
    saveAll(next);
    setOpen(false);
  }

  function remove(name: string) {
    if (!window.confirm(`Delete view "${name}"?`)) return;
    const next = views.filter(v => v.name !== name);
    setViews(next);
    saveAll(next);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="inline-flex items-center gap-1 px-2 py-1.5 text-sm rounded-md border border-border hover:bg-surface-alt"
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Saved views (browser-local)"
      >
        <BookmarkIcon size={11} /> Views <ChevronDownIcon size={11} />
      </button>
      {open && (
        <div
          className="absolute z-popover top-full left-0 mt-1 w-[280px] bg-surface border border-border rounded-md shadow-lg p-1.5"
          onMouseLeave={() => setOpen(false)}
        >
          <button
            type="button"
            onClick={() => { setOpen(false); router.push(pathname, { scroll: false }); }}
            className="w-full text-left px-2 py-1 text-sm rounded hover:bg-surface-alt"
          >
            All tasks
          </button>
          {views.length === 0 && (
            <div className="px-2 py-1 text-xs text-ink-muted italic">
              No saved views yet. Configure filters and hit “Save current as…”.
            </div>
          )}
          {views.map(v => (
            <div
              key={v.name}
              className="flex items-center gap-1 group hover:bg-surface-alt rounded"
            >
              <button
                type="button"
                onClick={() => applyView(v)}
                className="flex-1 text-left px-2 py-1 text-sm truncate"
                title={v.query || '(no filters)'}
              >
                {v.name}
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); remove(v.name); }}
                aria-label={`Delete view ${v.name}`}
                className="px-1 text-ink-muted hover:text-danger-600 opacity-0 group-hover:opacity-100"
              >
                <Trash2Icon size={11} />
              </button>
            </div>
          ))}
          <div className="my-1 border-t border-border" />
          <button
            type="button"
            onClick={saveCurrent}
            disabled={!currentQuery}
            className="w-full text-left px-2 py-1 text-sm rounded hover:bg-surface-alt disabled:opacity-50 disabled:cursor-not-allowed text-brand-700"
            title={!currentQuery ? 'Set some filters first' : 'Save the current filter combo'}
          >
            + Save current as…
          </button>
        </div>
      )}
    </div>
  );
}
