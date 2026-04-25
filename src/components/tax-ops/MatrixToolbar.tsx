'use client';

// Shared toolbar strip above every tax-type category matrix:
// year selector + row count + export-to-Excel button.
//
// The export button calls GET /api/tax-ops/matrix/export (built in
// 36.D) with the page's tax_type + period_pattern + year and triggers
// a browser download. Falls back silently if the endpoint errors —
// the toast surfaces the failure.

import { useState, useMemo } from 'react';
import { DownloadIcon } from 'lucide-react';
import { useToast } from '@/components/Toaster';
import { FILING_STATUSES, filingStatusLabel } from './FilingStatusBadge';
import { useTaxTeamMembers } from './useMatrixData';
import { SearchableSelect, type SearchableOption } from '@/components/ui/SearchableSelect';

interface Props {
  year: number;
  years: number[];
  onYearChange: (year: number) => void;
  count: number;
  countLabel: string;                 // "entities on quarterly VAT"
  extraChildren?: React.ReactNode;    // slot for page-specific controls (toggles)
  exportTaxType: string;              // e.g. 'vat_quarterly'
  exportPeriodPattern?: string;
  exportServiceKind?: 'filing' | 'review';
  exportShowInactive?: boolean;
  /**
   * Stint 39.D — status filter. When set (non-'all'), parent page should
   * hide rows where no period cell has that status. 'all' (default) shows
   * every row. Required for Diego's follow-up workflow: pick
   * "info_to_request" and see only the entities he still needs to chase.
   */
  statusFilter?: string;
  onStatusFilterChange?: (next: string) => void;
  /**
   * Stint 43.D7 — partner in charge filter. 'all' / '__unassigned' /
   * any tax_team_members.short_name. Combined AND with status + associate.
   */
  partnerFilter?: string;
  onPartnerFilterChange?: (next: string) => void;
  /** Stint 43.D7 — associate filter, mirrors partnerFilter. */
  associateFilter?: string;
  onAssociateFilterChange?: (next: string) => void;
}

export function MatrixToolbar({
  year, years, onYearChange,
  count, countLabel,
  extraChildren,
  exportTaxType, exportPeriodPattern, exportServiceKind, exportShowInactive,
  statusFilter, onStatusFilterChange,
  partnerFilter, onPartnerFilterChange,
  associateFilter, onAssociateFilterChange,
}: Props) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  // Lazy-load team members only when at least one ownership filter is wired
  // so pages that don't use them don't pay the fetch cost.
  const ownershipFiltersWired = !!(onPartnerFilterChange || onAssociateFilterChange);
  const { members } = useTaxTeamMembers();
  // Build SearchableSelect options once. "All" + "Unassigned" sit on top
  // of the team list so Diego can clear the filter without scrolling.
  const ownershipOptions = useMemo<SearchableOption[]>(() => {
    if (!ownershipFiltersWired) return [];
    return [
      { value: 'all', label: 'All' },
      { value: '__unassigned', label: 'Unassigned' },
      ...members.map(m => ({
        value: m.short_name,
        label: m.full_name ? `${m.short_name} · ${m.full_name}` : m.short_name,
      })),
    ];
  }, [ownershipFiltersWired, members]);

  async function downloadExcel() {
    setBusy(true);
    try {
      const qs = new URLSearchParams();
      qs.set('tax_type', exportTaxType);
      qs.set('year', String(year));
      if (exportPeriodPattern) qs.set('period_pattern', exportPeriodPattern);
      if (exportServiceKind) qs.set('service_kind', exportServiceKind);
      if (exportShowInactive) qs.set('show_inactive', '1');

      const res = await fetch(`/api/tax-ops/matrix/export?${qs}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const filename = `${exportTaxType}_${year}.xlsx`;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`Downloaded ${filename}`);
    } catch (e) {
      toast.error(`Export failed: ${String(e instanceof Error ? e.message : e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <label className="inline-flex items-center gap-1.5 text-[12.5px]">
        <span className="text-ink-muted">Period year:</span>
        <select
          value={year}
          onChange={(e) => onYearChange(Number(e.target.value))}
          className="px-2 py-1 text-[12.5px] border border-border rounded-md bg-surface"
        >
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </label>
      {onStatusFilterChange && (
        <label className="inline-flex items-center gap-1.5 text-[12.5px]">
          <span className="text-ink-muted">Status:</span>
          <select
            value={statusFilter ?? 'all'}
            onChange={(e) => onStatusFilterChange(e.target.value)}
            className="px-2 py-1 text-[12.5px] border border-border rounded-md bg-surface"
          >
            <option value="all">All</option>
            {FILING_STATUSES.map(s => (
              <option key={s} value={s}>{filingStatusLabel(s)}</option>
            ))}
            <option value="__empty">No status set</option>
          </select>
        </label>
      )}
      {onPartnerFilterChange && (
        <label className="inline-flex items-center gap-1.5 text-[12.5px]">
          <span className="text-ink-muted">Partner:</span>
          <SearchableSelect
            options={ownershipOptions}
            value={partnerFilter ?? 'all'}
            onChange={onPartnerFilterChange}
            ariaLabel="Filter by partner in charge"
          />
        </label>
      )}
      {onAssociateFilterChange && (
        <label className="inline-flex items-center gap-1.5 text-[12.5px]">
          <span className="text-ink-muted">Associate:</span>
          <SearchableSelect
            options={ownershipOptions}
            value={associateFilter ?? 'all'}
            onChange={onAssociateFilterChange}
            ariaLabel="Filter by associate working"
          />
        </label>
      )}
      {(statusFilter && statusFilter !== 'all')
        || (partnerFilter && partnerFilter !== 'all')
        || (associateFilter && associateFilter !== 'all') ? (
        <button
          type="button"
          onClick={() => {
            onStatusFilterChange?.('all');
            onPartnerFilterChange?.('all');
            onAssociateFilterChange?.('all');
          }}
          className="text-[11px] text-ink-muted hover:text-ink underline"
          title="Clear all filters"
        >
          clear filters
        </button>
      ) : null}
      {extraChildren}
      <div className="text-[11.5px] text-ink-muted">
        {count} {countLabel}
      </div>
      <div className="ml-auto">
        <button
          onClick={downloadExcel}
          disabled={busy || count === 0}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-[12px] rounded-md border border-border hover:bg-surface-alt disabled:opacity-50"
          title="Download this view as Excel"
        >
          <DownloadIcon size={12} />
          {busy ? 'Exporting…' : 'Export Excel'}
        </button>
      </div>
    </div>
  );
}
