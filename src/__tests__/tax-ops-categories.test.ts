// Stint 38.C · sidebar category helpers.
//
// The sidebar now fetches /api/tax-ops/categories. These tests lock
// the shape the endpoint must return + the grouping logic used to
// build the sub-nav items. No network — pure function assertions.

import { describe, it, expect } from 'vitest';

interface TaxCategory {
  tax_type: string;
  period_pattern: string;
  sidebar_label: string;
  sidebar_icon: string | null;
  sidebar_group: string | null;
  sidebar_order: number;
}

// Mirrors the logic in Sidebar.tsx :: buildTaxCategoryNavItems.
// Kept as a pure helper here to assert the grouping contract.
function groupByGroup(cats: TaxCategory[]): { flat: TaxCategory[]; groups: Record<string, TaxCategory[]> } {
  const flat: TaxCategory[] = [];
  const groups: Record<string, TaxCategory[]> = {};
  for (const c of cats) {
    if (c.sidebar_group) {
      if (!groups[c.sidebar_group]) groups[c.sidebar_group] = [];
      groups[c.sidebar_group].push(c);
    } else {
      flat.push(c);
    }
  }
  return { flat, groups };
}

describe('tax category grouping', () => {
  const sample: TaxCategory[] = [
    { tax_type: 'cit_annual',    period_pattern: 'annual',    sidebar_label: 'Corporate tax returns', sidebar_icon: 'LandmarkIcon',    sidebar_group: null,  sidebar_order: 10 },
    { tax_type: 'vat_annual',    period_pattern: 'annual',    sidebar_label: 'Annual',                sidebar_icon: 'ReceiptIcon',     sidebar_group: 'vat', sidebar_order: 20 },
    { tax_type: 'vat_quarterly', period_pattern: 'quarterly', sidebar_label: 'Quarterly',             sidebar_icon: 'ReceiptIcon',     sidebar_group: 'vat', sidebar_order: 22 },
    { tax_type: 'vat_monthly',   period_pattern: 'monthly',   sidebar_label: 'Monthly',               sidebar_icon: 'ReceiptIcon',     sidebar_group: 'vat', sidebar_order: 23 },
    { tax_type: 'wht_director_monthly', period_pattern: 'adhoc', sidebar_label: 'Withholding tax',   sidebar_icon: 'WalletIcon',      sidebar_group: null,  sidebar_order: 40 },
  ];

  it('splits flat top-level items from grouped items', () => {
    const { flat, groups } = groupByGroup(sample);
    expect(flat).toHaveLength(2);
    expect(flat.map(c => c.tax_type)).toEqual(['cit_annual', 'wht_director_monthly']);
    expect(Object.keys(groups)).toEqual(['vat']);
    expect(groups.vat).toHaveLength(3);
  });

  it('preserves sidebar_order within each group', () => {
    const { groups } = groupByGroup(sample);
    const vatOrders = groups.vat!.map(c => c.sidebar_order);
    expect(vatOrders).toEqual([20, 22, 23]);
  });

  it('empty input → empty flat + empty groups', () => {
    const { flat, groups } = groupByGroup([]);
    expect(flat).toEqual([]);
    expect(groups).toEqual({});
  });

  it('a category with group="custom" is grouped separately from vat', () => {
    const withCustom: TaxCategory[] = [
      ...sample,
      { tax_type: 'dac6_annual', period_pattern: 'annual', sidebar_label: 'DAC6', sidebar_icon: null, sidebar_group: 'intl', sidebar_order: 45 },
    ];
    const { groups } = groupByGroup(withCustom);
    expect(Object.keys(groups).sort()).toEqual(['intl', 'vat']);
    expect(groups.intl).toHaveLength(1);
  });
});
