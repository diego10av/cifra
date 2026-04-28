'use client';

// /tax-ops/cit — Corporate tax returns (Form 500) per entity.
// Stint 37.D redesign: family column visible, Assessment {year-1}
// editable inline, NWT Review {year} collapsed into a column (was
// its own page), year-dynamic column labels.

import { useState, useMemo, useCallback } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { CrmErrorBox } from '@/components/crm/CrmErrorBox';
import { useToast } from '@/components/Toaster';
import { TaxTypeMatrix, type MatrixColumn, type MatrixEntity } from '@/components/tax-ops/TaxTypeMatrix';
import {
  useMatrixData, applyStatusChange, useClientGroups, filterEntities,
  makeReorderHandler,
} from '@/components/tax-ops/useMatrixData';
import { yearOptions } from '@/components/tax-ops/yearOptions';
import {
  partnerInChargeColumn, associatesWorkingColumn, lastActionColumn, contactsColumn, commentsColumn,
  priceColumn, deadlineColumn, familyColumn, formColumn,
} from '@/components/tax-ops/matrix-row-columns';
import { MatrixToolbar } from '@/components/tax-ops/MatrixToolbar';
import { AssessmentInlineEditor } from '@/components/tax-ops/AssessmentInlineEditor';
import { NwtReviewInlineCell } from '@/components/tax-ops/NwtReviewInlineCell';
import { TaxProvisionInlineCell } from '@/components/tax-ops/TaxProvisionInlineCell';
import { AddEntityRow } from '@/components/tax-ops/AddEntityRow';
import { RemoveRowButton } from '@/components/tax-ops/RemoveRowButton';
import { FilingEditDrawer } from '@/components/tax-ops/FilingEditDrawer';

const YEAR_OPTIONS = yearOptions();

export default function CitPage() {
  const [year, setYear] = useState(2025);
  const [statusFilter, setStatusFilter] = useState('all');
  const [partnerFilter, setPartnerFilter] = useState('all');
  const [associateFilter, setAssociateFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState(''); // Stint 64
  const [editingFilingId, setEditingFilingId] = useState<string | null>(null);
  const toast = useToast();
  const { groups, refetch: refetchGroups } = useClientGroups();

  const current = useMatrixData({ tax_type: 'cit_annual', year, period_pattern: 'annual' });
  const prior = useMatrixData({ tax_type: 'cit_annual', year: year - 1, period_pattern: 'annual' });
  // NWT review column — same entity set, but service_kind='review' + show_inactive
  // so we also see entities NOT opted in (so Diego can opt them in inline).
  const nwt = useMatrixData({
    tax_type: 'nwt_annual', year, period_pattern: 'annual',
    service_kind: 'review', show_inactive: true,
  });
  // Stint 64.J — Tax Provision column. Same entity set, service_kind='provision'
  // on tax_type='cit_annual'. ~20/160 entities opt in (Diego's estimate); the
  // rest render "+ Opt in" so he can attach a provision when a client suddenly
  // sends a draft FS mid-year.
  const provision = useMatrixData({
    tax_type: 'cit_annual', year, period_pattern: 'annual',
    service_kind: 'provision', show_inactive: true,
  });

  // Map entity_id → prior-year cell (for assessment column)
  const priorCellByEntity = useMemo(() => {
    if (!prior.data) return new Map<string, ReturnType<typeof getCell>>();
    const m = new Map<string, ReturnType<typeof getCell>>();
    for (const e of prior.data.entities) {
      m.set(e.id, getCell(e, String(year - 1)));
    }
    return m;
  }, [prior.data, year]);

  // Map entity_id → NWT review cell + obligation_id
  const nwtCellByEntity = useMemo(() => {
    if (!nwt.data) return new Map<string, { obligation_id: string | null; cell: ReturnType<typeof getCell> }>();
    const m = new Map<string, { obligation_id: string | null; cell: ReturnType<typeof getCell> }>();
    for (const e of nwt.data.entities) {
      m.set(e.id, { obligation_id: e.obligation_id, cell: getCell(e, String(year)) });
    }
    return m;
  }, [nwt.data, year]);

  // Map entity_id → Tax Provision cell + obligation_id (stint 64.J).
  const provisionCellByEntity = useMemo(() => {
    if (!provision.data) return new Map<string, { obligation_id: string | null; cell: ReturnType<typeof getCell> }>();
    const m = new Map<string, { obligation_id: string | null; cell: ReturnType<typeof getCell> }>();
    for (const e of provision.data.entities) {
      m.set(e.id, { obligation_id: e.obligation_id, cell: getCell(e, String(year)) });
    }
    return m;
  }, [provision.data, year]);

  const refetchAll = useCallback(() => {
    current.refetch();
    prior.refetch();
    nwt.refetch();
    provision.refetch();
  }, [current, prior, nwt, provision]);

  async function patchFiling(filingId: string, patch: Record<string, unknown>): Promise<void> {
    const res = await fetch(`/api/tax-ops/filings/${filingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error(`Save failed (${res.status})`);
  }

  async function createFiling(body: Record<string, unknown>): Promise<void> {
    const res = await fetch('/api/tax-ops/filings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      throw new Error(b?.error ?? `Create failed (${res.status})`);
    }
  }

  async function createObligation(body: Record<string, unknown>): Promise<void> {
    const res = await fetch('/api/tax-ops/obligations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      throw new Error(b?.error ?? `Opt-in failed (${res.status})`);
    }
  }

  const periodLabel = String(year);
  const tolerance = current.data?.admin_tolerance_days ?? 0;
  const filtered = filterEntities({
    entities: current.data?.entities ?? [],
    status: statusFilter,
    partner: partnerFilter,
    associate: associateFilter,
    periodLabels: [periodLabel],
    query: searchQuery,
  });
  const columns: MatrixColumn[] = [
    familyColumn({
      groups,
      refetch: refetchAll,
      onGroupsChanged: refetchGroups,
    }),
    formColumn({ refetch: refetchAll, toast }),
    { key: periodLabel, label: `Status ${year}`, widthClass: 'w-[140px]' },
    lastActionColumn([periodLabel], current.refetch),
    deadlineColumn(periodLabel, tolerance),
    partnerInChargeColumn([periodLabel], current.refetch),
    associatesWorkingColumn([periodLabel], current.refetch),
    contactsColumn([periodLabel], current.refetch),
    {
      key: `assessment_${year - 1}`,
      label: `Assessment ${year - 1}`,
      widthClass: 'w-[180px]',
      render: (e) => {
        const priorCell = priorCellByEntity.get(e.id);
        return (
          <AssessmentInlineEditor
            filingId={priorCell?.filing_id ?? null}
            currentStatus={priorCell?.status ?? null}
            assessmentDate={priorCell?.tax_assessment_received_at ?? null}
            assessmentOutcome={(priorCell?.tax_assessment_outcome ?? null) as 'aligned' | 'under_audit' | null}
            onSave={async ({ status, assessmentDate, assessmentOutcome }) => {
              if (!priorCell?.filing_id) return;
              await patchFiling(priorCell.filing_id, {
                status,
                tax_assessment_received_at: assessmentDate,
                tax_assessment_outcome: assessmentOutcome,
              });
              refetchAll();
            }}
          />
        );
      },
    },
    {
      key: `nwt_review_${year}`,
      label: `NWT Review ${year}`,
      widthClass: 'w-[200px]',
      render: (e) => {
        const nwtInfo = nwtCellByEntity.get(e.id) ?? { obligation_id: null, cell: null };
        return (
          <NwtReviewInlineCell
            entityId={e.id}
            year={year}
            cell={{
              obligation_id: nwtInfo.obligation_id,
              filing_id: nwtInfo.cell?.filing_id ?? null,
              status: nwtInfo.cell?.status ?? null,
              draft_sent_at: nwtInfo.cell?.draft_sent_at ?? null,
              filed_at: nwtInfo.cell?.filed_at ?? null,
              comments: nwtInfo.cell?.comments ?? null,
              last_action_at: nwtInfo.cell?.last_action_at ?? null,
            }}
            onOptIn={async () => {
              await createObligation({
                entity_id: e.id,
                tax_type: 'nwt_annual',
                period_pattern: 'annual',
                service_kind: 'review',
              });
              nwt.refetch();
            }}
            onCreateFiling={async (nextStatus) => {
              // Need obligation_id — if just opted in, refetch first
              const info = nwtCellByEntity.get(e.id);
              if (!info?.obligation_id) {
                throw new Error('Opt in first, then set a status');
              }
              await createFiling({
                obligation_id: info.obligation_id,
                period_label: periodLabel,
                status: nextStatus,
              });
              nwt.refetch();
            }}
            onUpdateStatus={async (nextStatus) => {
              const info = nwtCellByEntity.get(e.id);
              if (!info?.cell?.filing_id) return;
              await patchFiling(info.cell.filing_id, { status: nextStatus });
              nwt.refetch();
            }}
            onPatchDates={async (patch) => {
              // Stint 43.D10 — quick action: mark interim/reco today
              // without leaving the matrix.
              const info = nwtCellByEntity.get(e.id);
              if (!info?.cell?.filing_id) return;
              await patchFiling(info.cell.filing_id, patch);
              nwt.refetch();
            }}
            onOptOut={async () => {
              // Stint 40.F — archive the nwt_annual review obligation.
              const info = nwtCellByEntity.get(e.id);
              if (!info?.obligation_id) return;
              const res = await fetch(`/api/tax-ops/obligations/${info.obligation_id}`, {
                method: 'DELETE',
              });
              if (!res.ok) {
                const b = await res.json().catch(() => ({}));
                throw new Error(b?.error ?? `Opt-out failed (${res.status})`);
              }
              nwt.refetch();
            }}
          />
        );
      },
    },
    {
      // Stint 64.J — Tax Provision column. Mirrors NWT Review pattern
      // (opt-in / status dropdown / opt-out). Uses provision-specific
      // status enum: awaiting_fs → fs_received → working → sent →
      // (optional) comments_received → working → sent → finalized.
      key: `tax_provision_${year}`,
      label: `Tax Provision ${year}`,
      widthClass: 'w-[200px]',
      render: (e) => {
        const info = provisionCellByEntity.get(e.id) ?? { obligation_id: null, cell: null };
        return (
          <TaxProvisionInlineCell
            entityId={e.id}
            year={year}
            cell={{
              obligation_id: info.obligation_id,
              filing_id: info.cell?.filing_id ?? null,
              status: info.cell?.status ?? null,
              comments: info.cell?.comments ?? null,
              last_action_at: info.cell?.last_action_at ?? null,
            }}
            onOptIn={async () => {
              await createObligation({
                entity_id: e.id,
                tax_type: 'cit_annual',
                period_pattern: 'annual',
                service_kind: 'provision',
              });
              provision.refetch();
            }}
            onCreateFiling={async (nextStatus) => {
              const cur = provisionCellByEntity.get(e.id);
              if (!cur?.obligation_id) {
                throw new Error('Opt in first, then set a status');
              }
              await createFiling({
                obligation_id: cur.obligation_id,
                period_label: periodLabel,
                status: nextStatus,
              });
              provision.refetch();
            }}
            onUpdateStatus={async (nextStatus) => {
              const cur = provisionCellByEntity.get(e.id);
              if (!cur?.cell?.filing_id) return;
              await patchFiling(cur.cell.filing_id, { status: nextStatus });
              provision.refetch();
            }}
            onOptOut={async () => {
              const cur = provisionCellByEntity.get(e.id);
              if (!cur?.obligation_id) return;
              const res = await fetch(`/api/tax-ops/obligations/${cur.obligation_id}`, { method: 'DELETE' });
              if (!res.ok) {
                const b = await res.json().catch(() => ({}));
                throw new Error(b?.error ?? `Opt-out failed (${res.status})`);
              }
              provision.refetch();
            }}
          />
        );
      },
    },
    commentsColumn([periodLabel], current.refetch),
    priceColumn([periodLabel], current.refetch),
  ];

  return (
    <div className="space-y-3">
      <PageHeader
        title="Form 500"
        subtitle={`Annual CIT (IRC) · Municipal Business Tax (ICC) · Net Wealth Tax (IF) — one unified return per entity. Tax Provision ${year}, Assessment ${year - 1} and NWT Review ${year} all editable inline. Click any status cell to update.`}
      />

      <MatrixToolbar
        year={year}
        years={YEAR_OPTIONS}
        onYearChange={setYear}
        count={filtered.length}
        countLabel={`entities · ${countFiled(current.data?.entities ?? [], periodLabel)} filed`}
        exportTaxType="cit_annual"
        exportPeriodPattern="annual"
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        partnerFilter={partnerFilter}
        onPartnerFilterChange={setPartnerFilter}
        associateFilter={associateFilter}
        onAssociateFilterChange={setAssociateFilter}
        entitiesForFilters={current.data?.entities ?? []}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
      />

      {current.error && <CrmErrorBox message={current.error} onRetry={refetchAll} />}

      {current.isLoading && !current.data && <PageSkeleton />}

      {current.data && (
        <TaxTypeMatrix
          entities={filtered}
          columns={columns}
          firstColLabel="Entity"
          onEditFiling={setEditingFilingId}
          periodLabelsForEdit={[periodLabel]}
          liquidationVisuals
          onLiquidationChanged={refetchAll}
          onReorderWithinFamily={makeReorderHandler(refetchAll)}
          onStatusChange={({ entity, column, cell, nextStatus }) =>
            applyStatusChange({ entity, column, cell, nextStatus, refetch: current.refetch, toast })
          }
          rowAction={(entity) => (
            <RemoveRowButton
              obligationId={entity.obligation_id}
              entityName={entity.legal_name}
              onRemoved={refetchAll}
            />
          )}
          groupFooter={(group) => (
            <AddEntityRow
              groupId={group.groupId}
              groupName={group.name}
              taxType="cit_annual"
              periodPattern="annual"
              onCreated={refetchAll}
            />
          )}
          emptyMessage="No entities have an active CIT obligation."
        />
      )}
      <FilingEditDrawer
        filingId={editingFilingId}
        onClose={() => setEditingFilingId(null)}
        onSaved={refetchAll}
      />
    </div>
  );
}

function getCell(e: MatrixEntity, period: string) {
  return e.cells[period] ?? null;
}

function countFiled(entities: MatrixEntity[], period: string): number {
  return entities.filter(e => {
    const c = getCell(e, period);
    return c && c.status === 'filed';
  }).length;
}
