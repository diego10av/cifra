// Unit tests for the eCDF box-mapping configuration. These do NOT call the
// database — they only assert that every treatment code routes to at least
// one declared box, and that the box filters are internally consistent.
//
// Catching these kinds of drifts at build time prevents silent corruption
// of the VAT return when a new treatment is added and its eCDF mapping is
// forgotten.

import { describe, it, expect } from 'vitest';
import { SIMPLIFIED_BOXES, ORDINARY_ADDITIONAL_BOXES } from '@/config/ecdf-boxes';
import {
  INCOMING_TREATMENTS,
  OUTGOING_TREATMENTS,
  TREATMENT_CODES,
} from '@/config/treatment-codes';

const ALL_BOXES = [...SIMPLIFIED_BOXES, ...ORDINARY_ADDITIONAL_BOXES];

// Treatments that intentionally have no box mapping because they signal
// "out of scope of the LU VAT return" / "needs manual handling" /
// "migrate me to a rate-specific sibling before filing". These still
// show up in the UI dropdown but their amounts do not flow into any
// eCDF line — the reviewer acknowledges this by picking the code.
const INTENTIONALLY_UNMAPPED = new Set<string>([
  // Out-of-scope / pass-through
  'LUX_00',           // legacy generic no-VAT, by design
  'OUT_SCOPE',        // generic out-of-scope (Chamber of Commerce, CSSF)
  'DEBOURS',          // disbursements under Art. 28§3 c LTVA
  'VAT_GROUP_OUT',    // supplies within LU VAT group (Art. 60ter)
  'EXEMPT_44B_RE',    // incoming exempt real-estate letting — informational only
  // Rate-specific-migration-required legacy codes
  'IC_ACQ',           // must be migrated to IC_ACQ_17/14/08/03 before filing
  // Incoming-invoiced exempts (no reverse charge) — Part 3.3 of the E-2 audit.
  // Routing these to box 435 (RC EU exempt) overstated that line against the
  // AED form's own definition. They belong only in audit / appendix output.
  'EXEMPT_44',        // incoming exempt Art. 44§1 d (fund-management), invoiced
  'EXEMPT_44A_FIN',   // incoming exempt Art. 44§1 a (financial), invoiced
  // Batch B additions:
  'MARGIN_NONDED',    // margin scheme — buyer cannot deduct; informational
  'OUT_OSS',          // reported separately via OSS, NOT on LU return boxes
  'PLATFORM_DEEMED',  // depends on direction of flow (LU vs OSS); reviewer routes
]);

describe('eCDF box mapping — coverage of every treatment code', () => {
  const mappedTreatments = new Set<string>();
  for (const def of ALL_BOXES) {
    for (const t of def.filter?.treatments ?? []) mappedTreatments.add(t);
  }

  for (const t of [...INCOMING_TREATMENTS, ...OUTGOING_TREATMENTS]) {
    if (INTENTIONALLY_UNMAPPED.has(t)) continue;
    it(`${t} routes to at least one eCDF box`, () => {
      expect(mappedTreatments.has(t)).toBe(true);
    });
  }
});

describe('eCDF box mapping — shape checks', () => {
  it('every formula box references only 3-digit ids, operators, numbers, or MAX(..)', () => {
    for (const def of ALL_BOXES) {
      if (def.computation !== 'formula' || !def.formula) continue;
      // After stripping box refs, MAX(), and allowed arithmetic, nothing
      // else should remain — specifically no column names or identifiers.
      const stripped = def.formula
        .replace(/\b\d{3}\b/g, '0')
        .replace(/MAX\s*\(/g, '(')
        .replace(/[\s+\-*/().,0-9]/g, '');
      expect(
        stripped,
        `Box ${def.box} has stray characters in its formula: "${def.formula}"`,
      ).toBe('');
    }
  });

  it('every sum-box filter.treatments references known codes', () => {
    const known = new Set(Object.keys(TREATMENT_CODES));
    for (const def of ALL_BOXES) {
      if (def.computation !== 'sum' || !def.filter?.treatments) continue;
      for (const t of def.filter.treatments) {
        expect(known.has(t), `Box ${def.box} references unknown treatment "${t}"`).toBe(true);
      }
    }
  });

  it('no duplicate box ids', () => {
    const ids = ALL_BOXES.map(b => b.box);
    const set = new Set(ids);
    expect(set.size).toBe(ids.length);
  });

  it('Box 409 (total RC taxable base) sums only the TAXABLE bases, not the exempt ones', () => {
    const box409 = ALL_BOXES.find(b => b.box === '409');
    // Taxable RC bases: cross-border (436 + 463) + domestic (438 + 440).
    // Batch B added the domestic components (RC_LUX_CONSTR + RC_LUX_SPEC).
    expect(box409?.formula).toBe('436 + 463 + 438 + 440');
    // Belt-and-braces: 435 (RC EU exempt) and 445 (RC non-EU exempt) must
    // NOT appear in the taxable-base total — that was the bug fixed in
    // Batch 2.
    expect(box409?.formula).not.toContain('435');
    expect(box409?.formula).not.toContain('445');
  });

  it('Box 085 has an explicit LU-taxable treatments filter', () => {
    const box085 = ALL_BOXES.find(b => b.box === '085');
    expect(box085?.filter?.treatments).toEqual(
      expect.arrayContaining(['LUX_17', 'LUX_14', 'LUX_08', 'LUX_03']),
    );
    // Must NOT include LUX_00 — that would add exempt lines into the
    // input-VAT invoiced total.
    expect(box085?.filter?.treatments).not.toContain('LUX_00');
  });

  // ════════════════ Agent E-2 critical-fix regressions ════════════════

  it('Box 097 (ordinary net VAT) does NOT add 077 on the output side', () => {
    // Agent E-2 CRITICAL finding: import VAT (077) is deductible input,
    // not output. The previous formula double-counted it.
    const box097 = ALL_BOXES.find(b => b.box === '097');
    expect(box097?.formula).toBe('046 + 056 + 410 + 045 - 093 - 099');
    // Anti-regression: `+ 077` must never reappear on the additive side.
    expect(box097?.formula).not.toMatch(/\+\s*077/);
  });

  it('Box 076 (simplified total) includes 046 and excludes 077', () => {
    // Agent E-2 CRITICAL finding: the simplified total was missing 046
    // (LU output VAT) and was double-counting 077 (import VAT).
    const box076 = ALL_BOXES.find(b => b.box === '076');
    expect(box076?.formula).toBe('046 + 056 + 410 + 045');
    expect(box076?.formula).toContain('046');
    expect(box076?.formula).not.toMatch(/\+\s*077/);
  });

  it('Box 046 (LU output VAT) sums all four rates, not only 17%', () => {
    // Agent E-2: 046 was hard-coded 701 * 0.17. A fund manager with a
    // 14% / 8% / 3% outgoing supply had that VAT dropped.
    const box046 = ALL_BOXES.find(b => b.box === '046');
    expect(box046?.formula).toBe('701 * 0.17 + 703 * 0.14 + 705 * 0.08 + 707 * 0.03');
  });

  it('Box 056 (VAT on IC acq) is rate-weighted, not sum-of-rc_amount', () => {
    // Agent E-2: binding 056 to the rate-breakdown ensures the form's
    // own cross-check 056 = sum(711..717 × rate) always holds.
    const box056 = ALL_BOXES.find(b => b.box === '056');
    expect(box056?.computation).toBe('formula');
    expect(box056?.formula).toBe('711 * 0.17 + 713 * 0.14 + 715 * 0.08 + 717 * 0.03');
  });

  it('Box 435 (RC EU exempt) filter is limited to RC_EU_EX only', () => {
    // Agent E-2 Part 3.3: the box is RC EU **exempt services**, not a
    // dumping ground for every incoming exempt flow.
    const box435 = ALL_BOXES.find(b => b.box === '435');
    expect(box435?.filter?.treatments).toEqual(['RC_EU_EX']);
    expect(box435?.filter?.treatments).not.toContain('EXEMPT_44');
    expect(box435?.filter?.treatments).not.toContain('EXEMPT_44A_FIN');
  });

  it('Box 022 (total turnover) sums all taxable rates + exempt + non-EU + EU', () => {
    const box022 = ALL_BOXES.find(b => b.box === '022');
    expect(box022?.formula).toBe('701 + 703 + 705 + 707 + 016 + 014 + 423 + 424');
  });

  it('Box 051 equals the sum of rate-specific IC acquisition boxes', () => {
    // Agent E-2 Part 1.7: 051 and 711+713+715+717 must reconcile; the
    // legacy IC_ACQ rate-unknown code must not leak into 051.
    const box051 = ALL_BOXES.find(b => b.box === '051');
    expect(box051?.computation).toBe('formula');
    expect(box051?.formula).toBe('711 + 713 + 715 + 717');
  });

  it('OUT_LUX_14/08/03 treatments route to boxes 703/705/707', () => {
    // Agent E-2 Part 3.1: without these codes a 14/8/3% outgoing supply
    // had to be mis-classified as OUT_LUX_17 or OUT_LUX_00.
    for (const [treatment, box] of [
      ['OUT_LUX_14', '703'],
      ['OUT_LUX_08', '705'],
      ['OUT_LUX_03', '707'],
    ] as const) {
      const def = ALL_BOXES.find(b => b.box === box);
      expect(def?.filter?.treatments).toContain(treatment);
    }
  });
});
