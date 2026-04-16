// eCDF Box Mapping per PRD Section 5.2-5.3.
//
// Each treatment code defined in src/config/treatment-codes.ts must route
// to at least one box below. If you add a treatment and forget to wire it
// here, the amount silently disappears from the return — so every new
// treatment MUST be added to one of the "treatments" arrays below.
//
// The box numbers follow the canonical TVA001N (simplified) and TVA002NA
// (ordinary) AED form layouts. When the AED publishes a new form version,
// update the SUSPECT lines flagged with TODO(form-version).
//
// ════════════════════════════════════════════════════════════════════════
// Opus fiscal audit — findings acted on (2026-04-16)
// ════════════════════════════════════════════════════════════════════════
// 1. Box 097 (CRITICAL): removed `+ 077` from the additive side. Import
//    VAT paid at customs is input VAT (deduction), never output.
// 2. Box 076 (CRITICAL): now `046 + 056 + 410 + 045` — added 046 (was
//    missing LU output VAT) and removed 077 (double-counting).
// 3. Box 435: trimmed filter to ['RC_EU_EX'] only. EXEMPT_44 and
//    EXEMPT_44A_FIN are incoming-invoiced exempts, not reverse-charge;
//    they previously inflated 435 against the form definition.
// 4. Box 056: now rate-weighted formula of 711/713/715/717 bases × rate,
//    instead of `sum(rc_amount)`. Makes 056 mathematically bound to the
//    rate-breakdown that the AED validator cross-checks.
// 5. Boxes 703/705/707 + 047/049/050 (NEW): rate-specific output VAT at
//    14/8/3%. Previously a fund manager with a 14% outgoing supply had
//    nowhere to land that amount.
// 6. Boxes 703/705/707 + 701 are now in SIMPLIFIED_BOXES (not only
//    ordinary) because box 076's output-VAT total depends on them.
// ════════════════════════════════════════════════════════════════════════

export type BoxDefinition = {
  box: string;
  label: string;
  computation: 'sum' | 'formula' | 'manual';
  // For 'sum': filter criteria
  filter?: {
    direction?: 'incoming' | 'outgoing';
    treatments?: string[];
    field?: 'amount_eur' | 'vat_applied' | 'rc_amount';
  };
  // For 'formula': reference other boxes
  formula?: string;
  section: string;
};

// Simplified Return boxes (TVA001N)
export const SIMPLIFIED_BOXES: BoxDefinition[] = [
  // ──────────────── Section A — Turnover (outgoing) ────────────────
  { box: '012', label: 'Turnover exempt under Art. 44', section: 'A', computation: 'sum',
    filter: { direction: 'outgoing', treatments: ['OUT_LUX_00'], field: 'amount_eur' } },
  // Box 014: non-EU customer supplies (outside LU VAT scope).
  // TODO(form-version): confirm box id on the latest TVA001N.
  { box: '014', label: 'Outgoing to non-EU (out of scope)', section: 'A', computation: 'sum',
    filter: { direction: 'outgoing', treatments: ['OUT_NONEU'], field: 'amount_eur' } },
  { box: '423', label: 'Supply of services to EU customers (B2B RC)', section: 'A', computation: 'sum',
    filter: { direction: 'outgoing', treatments: ['OUT_EU_RC'], field: 'amount_eur' } },
  // IC supply of goods (box 424 on TVA001N; keep labelled explicitly).
  { box: '424', label: 'Intra-Community supply of goods', section: 'A', computation: 'sum',
    filter: { direction: 'outgoing', treatments: ['OUT_IC_GOODS', 'OUT_LU_TRIANG'], field: 'amount_eur' } },
  { box: '450', label: 'Total supply to EU customers', section: 'A', computation: 'formula',
    formula: '423 + 424' },

  // Rate-specific LU taxable turnover — bases.
  // Previously only 701 (17%) existed and it lived in ORDINARY_ADDITIONAL_
  // BOXES; the audit flagged that (i) simplified filers with LU taxable
  // output had their 046 silently zero, and (ii) 14/8/3% output had no
  // treatment code at all. Now all four rates sit in the simplified list
  // so box 076 can reference 046.
  { box: '701', label: 'Taxable turnover at 17%', section: 'I', computation: 'sum',
    filter: { direction: 'outgoing', treatments: ['OUT_LUX_17', 'OUT_LUX_17_OPT'], field: 'amount_eur' } },
  { box: '703', label: 'Taxable turnover at 14%', section: 'I', computation: 'sum',
    filter: { direction: 'outgoing', treatments: ['OUT_LUX_14'], field: 'amount_eur' } },
  { box: '705', label: 'Taxable turnover at 8%',  section: 'I', computation: 'sum',
    filter: { direction: 'outgoing', treatments: ['OUT_LUX_08'], field: 'amount_eur' } },
  { box: '707', label: 'Taxable turnover at 3%',  section: 'I', computation: 'sum',
    filter: { direction: 'outgoing', treatments: ['OUT_LUX_03'], field: 'amount_eur' } },

  // Rate-specific LU taxable turnover — output VAT.
  // TODO(form-version): confirm 047/049/050 box ids on the current
  // TVA001N / TVA002NA; they SUSPECT numbers from the AED's canonical
  // rate-breakdown block.
  { box: '046', label: 'Output VAT — total (all LU rates)', section: 'I', computation: 'formula',
    formula: '701 * 0.17 + 703 * 0.14 + 705 * 0.08 + 707 * 0.03' },
  { box: '047', label: 'Output VAT (14% breakdown)', section: 'I', computation: 'formula',
    formula: '703 * 0.14' },
  { box: '049', label: 'Output VAT (8% breakdown)', section: 'I', computation: 'formula',
    formula: '705 * 0.08' },
  { box: '050', label: 'Output VAT (3% breakdown)', section: 'I', computation: 'formula',
    formula: '707 * 0.03' },

  // ──────────────── Section B — Intra-Community acquisitions ────────────────
  // 051 sums the rate-specific IC_ACQ_* variants. The legacy generic
  // IC_ACQ code is retained in treatment-codes.ts for backward-compat
  // with older rows, and the classifier must migrate those to one of
  // the rate-specific codes before a declaration is locked — the
  // pre-approval validator surfaces any remaining IC_ACQ-without-rate as
  // a blocking error so the return arithmetic 051 = 711+713+715+717
  // holds at filing time.
  { box: '051', label: 'IC acquisitions of goods (all rates)', section: 'B', computation: 'formula',
    formula: '711 + 713 + 715 + 717' },
  { box: '711', label: 'IC acquisitions at 17%', section: 'B', computation: 'sum',
    filter: { treatments: ['IC_ACQ_17'], field: 'amount_eur' } },
  { box: '713', label: 'IC acquisitions at 14%', section: 'B', computation: 'sum',
    filter: { treatments: ['IC_ACQ_14'], field: 'amount_eur' } },
  { box: '715', label: 'IC acquisitions at 8%',  section: 'B', computation: 'sum',
    filter: { treatments: ['IC_ACQ_08'], field: 'amount_eur' } },
  { box: '717', label: 'IC acquisitions at 3%',  section: 'B', computation: 'sum',
    filter: { treatments: ['IC_ACQ_03'], field: 'amount_eur' } },
  // Box 056: rate-weighted VAT on IC acquisitions. Previously summed
  // rc_amount, which drifted from the form's own arithmetic whenever
  // rc_amount was re-entered without recomputation. Now bound to the
  // rate-breakdown. Rate-unknown IC_ACQ lines must be migrated before
  // filing.
  { box: '056', label: 'VAT on IC acquisitions', section: 'B', computation: 'formula',
    formula: '711 * 0.17 + 713 * 0.14 + 715 * 0.08 + 717 * 0.03' },
  { box: '712', label: 'VAT on IC acquisitions (breakdown)', section: 'B', computation: 'formula',
    formula: '056' },

  // ──────────────── Section C — Import VAT ────────────────
  // Box 075 = base of imported goods; box 077 = import VAT paid at customs.
  // TODO(form-version): confirm exact box ids and placement on TVA001N/TVA002NA.
  { box: '075', label: 'Import of goods (base)', section: 'C', computation: 'sum',
    filter: { treatments: ['IMPORT_VAT'], field: 'amount_eur' } },
  { box: '077', label: 'Import VAT paid at customs', section: 'C', computation: 'sum',
    filter: { treatments: ['IMPORT_VAT'], field: 'vat_applied' } },

  // ──────────────── Section D — Reverse charge on services ────────────────
  // D.1 — EU suppliers
  // Rate-split bases: 17% default + 14 / 8 / 3 for reduced-rate services.
  // Box 436 aggregates all rate-variants so the TVA001N section total
  // stays correct.
  { box: '436', label: 'RC EU taxable services — total base (all rates)', section: 'D', computation: 'formula',
    formula: '741 + 743 + 745 + 747' },
  { box: '741', label: 'RC EU taxable base 17%', section: 'D', computation: 'sum',
    filter: { treatments: ['RC_EU_TAX'], field: 'amount_eur' } },
  { box: '743', label: 'RC EU taxable base 14%', section: 'D', computation: 'sum',
    filter: { treatments: ['RC_EU_TAX_14'], field: 'amount_eur' } },
  { box: '745', label: 'RC EU taxable base 8%',  section: 'D', computation: 'sum',
    filter: { treatments: ['RC_EU_TAX_08'], field: 'amount_eur' } },
  { box: '747', label: 'RC EU taxable base 3%',  section: 'D', computation: 'sum',
    filter: { treatments: ['RC_EU_TAX_03'], field: 'amount_eur' } },
  { box: '462', label: 'VAT on RC EU taxable (rate-weighted)', section: 'D', computation: 'formula',
    formula: '741 * 0.17 + 743 * 0.14 + 745 * 0.08 + 747 * 0.03' },
  { box: '742', label: 'VAT on RC EU taxable breakdown', section: 'D', computation: 'formula',
    formula: '462' },
  // Box 435 is RC EU **exempt services** only. EXEMPT_44 and
  // EXEMPT_44A_FIN are incoming-invoiced exempts (no reverse charge);
  // they previously inflated 435 against the form's own definition.
  // Those codes now land on no box (intentional: purely informational
  // for the input side — see INTENTIONALLY_UNMAPPED in the box-coverage
  // test).
  { box: '435', label: 'RC EU exempt services (base)', section: 'D', computation: 'sum',
    filter: { treatments: ['RC_EU_EX'], field: 'amount_eur' } },

  // D.2 — Non-EU suppliers (rate-split same as D.1)
  { box: '463', label: 'RC non-EU taxable services — total base (all rates)', section: 'D', computation: 'formula',
    formula: '751 + 753 + 755 + 757' },
  { box: '751', label: 'RC non-EU taxable base 17%', section: 'D', computation: 'sum',
    filter: { treatments: ['RC_NONEU_TAX'], field: 'amount_eur' } },
  { box: '753', label: 'RC non-EU taxable base 14%', section: 'D', computation: 'sum',
    filter: { treatments: ['RC_NONEU_TAX_14'], field: 'amount_eur' } },
  { box: '755', label: 'RC non-EU taxable base 8%',  section: 'D', computation: 'sum',
    filter: { treatments: ['RC_NONEU_TAX_08'], field: 'amount_eur' } },
  { box: '757', label: 'RC non-EU taxable base 3%',  section: 'D', computation: 'sum',
    filter: { treatments: ['RC_NONEU_TAX_03'], field: 'amount_eur' } },
  { box: '464', label: 'VAT on RC non-EU taxable (rate-weighted)', section: 'D', computation: 'formula',
    formula: '751 * 0.17 + 753 * 0.14 + 755 * 0.08 + 757 * 0.03' },
  { box: '752', label: 'VAT on RC non-EU taxable breakdown', section: 'D', computation: 'formula',
    formula: '464' },
  { box: '445', label: 'RC non-EU exempt services (base)', section: 'D', computation: 'sum',
    filter: { treatments: ['RC_NONEU_EX'], field: 'amount_eur' } },

  // D.3 — Domestic reverse-charge (construction, scrap, emission allowances).
  // Art. 61§2 LTVA transposing Art. 199 / 199a Directive. Separate lines
  // so the AED can identify the anti-fraud mechanisms used.
  // TODO(form-version): confirm box ids 438 / 440 against the current
  // TVA002NA — these are the conventional AED codes for domestic RC.
  { box: '438', label: 'Domestic RC — construction (base)', section: 'D', computation: 'sum',
    filter: { treatments: ['RC_LUX_CONSTR_17'], field: 'amount_eur' } },
  { box: '439', label: 'VAT on domestic RC construction (17%)', section: 'D', computation: 'formula',
    formula: '438 * 0.17' },
  { box: '440', label: 'Domestic RC — scrap / emission (base)', section: 'D', computation: 'sum',
    filter: { treatments: ['RC_LUX_SPEC_17'], field: 'amount_eur' } },
  { box: '441', label: 'VAT on domestic RC scrap (17%)', section: 'D', computation: 'formula',
    formula: '440 * 0.17' },

  // D totals — taxable RC base and total RC VAT due (cross-border + domestic)
  { box: '409', label: 'Total RC taxable base', section: 'D', computation: 'formula',
    formula: '436 + 463 + 438 + 440' },
  { box: '410', label: 'Total RC VAT due', section: 'D', computation: 'formula',
    formula: '462 + 464 + 439 + 441' },

  // ──────────────── Section E — Autolivraison / self-supply ────────────────
  // Self-supply is declared as both output VAT (box 044) and deductible
  // input VAT (box 093 via the ordinary return); the amount_eur is the
  // base and vat_applied the VAT charged to self.
  // TODO(form-version): confirm box ids on TVA001N.
  { box: '044', label: 'Autolivraison base (17%)', section: 'E', computation: 'sum',
    filter: { treatments: ['AUTOLIV_17'], field: 'amount_eur' } },
  { box: '045', label: 'Autolivraison VAT (17%)', section: 'E', computation: 'formula',
    formula: '044 * 0.17' },

  // ──────────────── Section F — Total tax due ────────────────
  // Box 076 — simplified total VAT due.
  // Previously `056 + 410 + 045 + 077`. Two CRITICAL errors:
  //   (i) missing 046 (domestic output VAT) — any simplified filer with
  //       LU taxable turnover had their output VAT silently dropped.
  //   (ii) including 077 (import VAT already paid at customs) double-
  //       charged the import VAT.
  { box: '076', label: 'Total VAT due (simplified)', section: 'F', computation: 'formula',
    formula: '046 + 056 + 410 + 045' },
];

// Additional boxes for Ordinary Return (TVA002NA / NT / NM)
export const ORDINARY_ADDITIONAL_BOXES: BoxDefinition[] = [
  // ──────────────── Section I — Turnover and output VAT ────────────────
  // 701/703/705/707/046/047/049/050 already live in SIMPLIFIED_BOXES and
  // are merged into the ordinary compute set by the engine. Here we only
  // add the ordinary-specific disclosure boxes.
  { box: '016', label: 'Exempt turnover (Art. 44)', section: 'I', computation: 'sum',
    filter: { direction: 'outgoing', treatments: ['OUT_LUX_00'], field: 'amount_eur' } },
  // Box 022 now sums every taxable rate and every exempt / out-of-scope
  // turnover. Previously only 701 (17%) was summed — 703/705/707 were
  // missing so a 14% / 8% / 3% outgoing supply was dropped from total
  // turnover.
  { box: '022', label: 'Total turnover', section: 'I', computation: 'formula',
    formula: '701 + 703 + 705 + 707 + 016 + 014 + 423 + 424' },

  // ──────────────── Section III — Input VAT deduction ────────────────
  // Box 085 = LU VAT actually invoiced at 17/14/8/3 (excludes exempt and
  // non-deductible treatments — those go to box 086/087 on their own).
  { box: '085', label: 'Lux input VAT invoiced (deductible tier)', section: 'III', computation: 'sum',
    filter: { direction: 'incoming', treatments: ['LUX_17', 'LUX_14', 'LUX_08', 'LUX_03'], field: 'vat_applied' } },
  { box: '087', label: 'Lux input VAT invoiced (non-deductible tier)', section: 'III', computation: 'sum',
    filter: { direction: 'incoming', treatments: ['LUX_17_NONDED'], field: 'vat_applied' } },
  { box: '458', label: 'Total Lux VAT invoiced', section: 'III', computation: 'formula',
    formula: '085 + 087' },
  { box: '093', label: 'Deductible input VAT', section: 'III', computation: 'manual' },
  { box: '095', label: 'Pro-rata percentage', section: 'III', computation: 'manual' },

  // Bad-debt regularisation.
  // Convention: rc_amount is ALWAYS positive and represents the amount
  // being clawed back from the Treasury (i.e. VAT the entity had
  // previously remitted on a now-uncollectible receivable). This is
  // enforced at the classifier / manual-entry layer. The 097 formula
  // subtracts 099 because that matches "output VAT reduced by the
  // amount the entity is reclaiming".
  { box: '099', label: 'Bad-debt relief regularisation', section: 'III', computation: 'sum',
    filter: { treatments: ['BAD_DEBT_RELIEF'], field: 'rc_amount' } },

  // ──────────────── Section IV — Net position ────────────────
  // Box 097 — net VAT due.
  // Previously `046 + 056 + 410 + 045 + 077 - 093 - 099`. The `+ 077`
  // was CRITICAL: import VAT is deductible input VAT, never output.
  // The reviewer enters 093 including the import-VAT contribution
  // (optionally pro-rated). If 093 excludes 077, the new net position
  // will understate the liability — surfaced as a pre-approval warning
  // (093 < 085 + 056 + 410 + 045 + 077 implies a pro-rata restriction).
  { box: '097', label: 'Net VAT due', section: 'IV', computation: 'formula',
    formula: '046 + 056 + 410 + 045 - 093 - 099' },
  { box: '102', label: 'Payment due', section: 'IV', computation: 'formula',
    formula: 'MAX(097, 0)' },
  { box: '103', label: 'Credit', section: 'IV', computation: 'formula',
    formula: 'MAX(-097, 0)' },
];
