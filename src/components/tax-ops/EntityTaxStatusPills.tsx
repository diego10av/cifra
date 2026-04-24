'use client';

// ════════════════════════════════════════════════════════════════════════
// EntityTaxStatusPills — stint 37.I
//
// Row of chips at the top of /tax-ops/entities/[id] showing the current
// status for each active tax_type this entity has. Quickly tells Diego
// "where we are" across all obligations in one glance.
//
// Grouped by (tax_type + current-year period) so a VAT monthly entity
// shows chips for Jan..Dec for the current year, a CIT entity shows
// one chip for current year. Click chip → filing detail.
//
// Pure display — data comes from the parent page's entity detail API.
// ════════════════════════════════════════════════════════════════════════

import Link from 'next/link';
import { FilingStatusBadge, filingStatusLabel } from './FilingStatusBadge';

interface Filing {
  id: string;
  tax_type: string;
  period_year: number;
  period_label: string;
  status: string;
}

function humanTaxType(t: string): string {
  return t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function shortPeriod(label: string): string {
  const q = label.match(/^\d{4}-(Q[1-4])$/);
  if (q) return q[1]!;
  const m = label.match(/^\d{4}-(\d{2})$/);
  if (m) {
    const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return names[Number(m[1]) - 1] ?? m[1]!;
  }
  return label;
}

export function EntityTaxStatusPills({ filings }: { filings: Filing[] }) {
  // Focus on the "latest meaningful" period per tax_type. Heuristic:
  //   - For annuals, the latest period_year row (usually just one).
  //   - For quarterly/monthly, show current-year filings in chrono order.
  // We sort by (period_year desc, period_label desc) and keep the first
  // occurrence per tax_type for annuals; for sub-annual types we keep
  // ALL rows from the most recent year.
  const currentYear = new Date().getFullYear();

  // Bucket by tax_type → sorted filings
  const byType = new Map<string, Filing[]>();
  for (const f of filings) {
    if (!byType.has(f.tax_type)) byType.set(f.tax_type, []);
    byType.get(f.tax_type)!.push(f);
  }

  const pills: Array<{ filing: Filing; label: string }> = [];
  for (const [taxType, list] of byType) {
    const sorted = [...list].sort((a, b) => {
      if (a.period_year !== b.period_year) return b.period_year - a.period_year;
      return b.period_label.localeCompare(a.period_label);
    });
    const isSubAnnual = sorted.some(f => /^\d{4}-(Q[1-4]|\d{2}|S[12])$/.test(f.period_label));
    if (isSubAnnual) {
      // Take up to the last 6 periods from the most recent year
      const latestYear = sorted[0]?.period_year;
      if (latestYear === undefined) continue;
      const sameYear = sorted
        .filter(f => f.period_year === latestYear)
        .sort((a, b) => a.period_label.localeCompare(b.period_label))
        .slice(0, 12);
      for (const f of sameYear) {
        pills.push({
          filing: f,
          label: `${humanTaxType(taxType)} ${shortPeriod(f.period_label)} ${f.period_year}`,
        });
      }
    } else {
      // Annual — take just the most recent
      const latest = sorted[0];
      if (latest) pills.push({
        filing: latest,
        label: `${humanTaxType(taxType)} ${latest.period_year}`,
      });
    }
  }

  if (pills.length === 0) {
    return (
      <div className="text-[12px] text-ink-muted italic">
        No filings on record yet for this entity.
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {pills.map(({ filing, label }) => {
        const outdated = filing.period_year < currentYear - 1;
        return (
          <Link
            key={filing.id}
            href={`/tax-ops/filings/${filing.id}`}
            className={[
              'group inline-flex items-center gap-1.5 px-2 py-0.5 rounded border transition-colors',
              'hover:border-brand-400 hover:bg-surface-alt',
              outdated ? 'border-border/60 opacity-70' : 'border-border',
            ].join(' ')}
            title={`${label} — ${filingStatusLabel(filing.status)} · click to open filing`}
          >
            <span className="text-[11px] text-ink-soft">{label}</span>
            <FilingStatusBadge status={filing.status} />
          </Link>
        );
      })}
    </div>
  );
}
