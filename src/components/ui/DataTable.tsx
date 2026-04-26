'use client';

// ════════════════════════════════════════════════════════════════════════
// DataTable — stint 45.F2.1
//
// Single canonical primitive for the simple tabular lists across cifra:
// home portfolio, /declarations list, /tax-ops/entities list, /clients
// expansion rows, etc.
//
// NOT a replacement for TaxTypeMatrix — that one carries grouping +
// inline-edit + sticky multi-col + per-period status chips, which
// would bloat this primitive past the point of usefulness. Keep both:
// DataTable for vanilla lists, TaxTypeMatrix for the Excel-grade matrices.
//
// Conventions (canon):
//   • bg-surface wrapper · rounded-lg · border border-border · overflow-hidden
//   • thead bg-surface-alt · text-2xs uppercase tracking-wide · text-ink-muted
//   • td px-3 py-2.5 · text-sm · border-t border-border on rows after the first
//   • hover:bg-surface-alt/50 (the canonical hover from F1.4)
//   • sticky-thead optional (set `stickyHeader`)
//
// Empty + loading states are rendered inline so consumers don't have
// to wrap.
// ════════════════════════════════════════════════════════════════════════

import { type ReactNode } from 'react';
import { Skeleton } from './Skeleton';

export interface DataTableColumn<Row> {
  /** Stable key for the column. */
  key: string;
  /** Header label — usually a short string, but ReactNode lets you put
   *  sort chevrons or icons in. */
  header: ReactNode;
  /** Custom cell renderer. If omitted, the table looks up `row[key]`
   *  and renders it as text. */
  render?: (row: Row, rowIndex: number) => ReactNode;
  /** Optional Tailwind width class (`w-[120px]`, `w-32`, etc.). */
  widthClass?: string;
  /** Right-align numeric columns + tabular-nums. */
  alignRight?: boolean;
  /** Make this column's text muted (for secondary metadata cols). */
  muted?: boolean;
  /** ARIA-only header label override when `header` is non-text. */
  ariaLabel?: string;
}

interface Props<Row> {
  rows: Row[];
  rowKey: (row: Row) => string;
  columns: DataTableColumn<Row>[];
  /** Click handler on a row — adds cursor-pointer + keyboard focus. */
  onRowClick?: (row: Row) => void;
  /** Render a per-row className for tinting/state effects. */
  rowClassName?: (row: Row) => string;
  /** When true, every row gets a subtle hover bg + cursor-pointer. */
  hoverable?: boolean;
  /** Stick the thead to the top during overflow scroll. */
  stickyHeader?: boolean;
  /** Shown when `rows` is empty AND loading is false. */
  emptyState?: ReactNode;
  /** Renders a skeleton table with `loadingRowCount` rows when true. */
  loading?: boolean;
  loadingRowCount?: number;
  /** Optional extra class on the outer wrapper. */
  className?: string;
  /** Optional caption rendered above the table (h-tag-friendly). */
  caption?: ReactNode;
}

export function DataTable<Row>({
  rows, rowKey, columns,
  onRowClick, rowClassName,
  hoverable = true,
  stickyHeader = false,
  emptyState,
  loading = false,
  loadingRowCount = 6,
  className = '',
  caption,
}: Props<Row>) {
  const totalCols = columns.length;

  if (loading) {
    return (
      <div className={['rounded-lg border border-border bg-surface overflow-hidden', className].join(' ')}>
        {caption && <div className="px-3 py-2 border-b border-border text-sm font-medium text-ink">{caption}</div>}
        <table className="w-full text-sm border-collapse">
          <thead className="bg-surface-alt">
            <tr>
              {columns.map(c => (
                <th
                  key={c.key}
                  scope="col"
                  className={[
                    'text-left px-3 py-2 text-2xs uppercase tracking-wide font-semibold text-ink-muted',
                    c.alignRight ? 'text-right' : '',
                    c.widthClass ?? '',
                  ].join(' ')}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: loadingRowCount }).map((_, i) => (
              <tr key={i} className="border-t border-border">
                {columns.map(c => (
                  <td key={c.key} className="px-3 py-2.5">
                    <Skeleton className="h-4 w-full max-w-[160px]" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className={['rounded-lg border border-border bg-surface overflow-hidden', className].join(' ')}>
        {caption && <div className="px-3 py-2 border-b border-border text-sm font-medium text-ink">{caption}</div>}
        {emptyState ?? (
          <div className="px-4 py-8 text-center text-sm text-ink-muted italic">No rows</div>
        )}
      </div>
    );
  }

  return (
    <div className={['rounded-lg border border-border bg-surface overflow-hidden', className].join(' ')}>
      {caption && <div className="px-3 py-2 border-b border-border text-sm font-medium text-ink">{caption}</div>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead className={['bg-surface-alt', stickyHeader ? 'sticky top-0 z-10' : ''].join(' ')}>
            <tr>
              {columns.map(c => (
                <th
                  key={c.key}
                  scope="col"
                  aria-label={c.ariaLabel}
                  className={[
                    'text-left px-3 py-2 text-2xs uppercase tracking-wide font-semibold text-ink-muted',
                    c.alignRight ? 'text-right' : '',
                    c.widthClass ?? '',
                  ].join(' ')}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const baseClass = [
                'border-t border-border',
                hoverable || onRowClick ? 'hover:bg-surface-alt/50' : '',
                onRowClick ? 'cursor-pointer' : '',
                rowClassName?.(row) ?? '',
              ].join(' ');
              return (
                <tr
                  key={rowKey(row)}
                  className={baseClass}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={onRowClick ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onRowClick(row);
                    }
                  } : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  role={onRowClick ? 'button' : undefined}
                >
                  {columns.map(c => {
                    const content = c.render
                      ? c.render(row, i)
                      : (row as Record<string, unknown>)[c.key];
                    return (
                      <td
                        key={c.key}
                        className={[
                          'px-3 py-2.5 align-middle',
                          c.alignRight ? 'text-right tabular-nums' : '',
                          c.muted ? 'text-ink-muted' : '',
                          c.widthClass ?? '',
                        ].join(' ')}
                      >
                        {content as ReactNode}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="sr-only" aria-live="polite">
        {rows.length} {rows.length === 1 ? 'row' : 'rows'}
      </div>
      {/* totalCols kept around for potential future colspan-empty rows */}
      <span className="hidden" aria-hidden="true" data-cols={totalCols} />
    </div>
  );
}
