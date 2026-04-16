// Treatment codes per PRD Section 5.1.
//
// Every line in the VAT appendix must receive exactly one treatment code.
// The code determines:
//   - which eCDF box(es) the line contributes to (see src/config/ecdf-boxes.ts)
//   - which section of the appendix the line appears in
//   - whether the amount must be self-assessed (reverse charge) vs invoiced
//
// Adding a code here requires a matching update to ecdf-boxes.ts (so the
// amount routes to a real box) and, ideally, a classifier rule in
// src/config/classification-rules.ts (so it can be auto-detected).

export const TREATMENT_CODES = {
  // ════════════════════════════════════════════════════════════════════
  // INCOMING — Luxembourg suppliers with VAT actually charged
  // ════════════════════════════════════════════════════════════════════
  LUX_17:           { label: 'Luxembourg VAT 17%', direction: 'incoming', vatRate: 0.17, description: 'Luxembourg supplier, VAT at 17%' },
  LUX_14:           { label: 'Luxembourg VAT 14%', direction: 'incoming', vatRate: 0.14, description: 'Luxembourg supplier, VAT at 14% (depositary)' },
  LUX_08:           { label: 'Luxembourg VAT 8%',  direction: 'incoming', vatRate: 0.08, description: 'Luxembourg supplier, VAT at 8% (certain services)' },
  LUX_03:           { label: 'Luxembourg VAT 3%',  direction: 'incoming', vatRate: 0.03, description: 'Luxembourg supplier, VAT at 3%' },
  LUX_00:           { label: 'Luxembourg no VAT',  direction: 'incoming', vatRate: 0,    description: 'Luxembourg supplier, no VAT — specific exemption basis not determined' },

  // Non-deductible LU input VAT (business entertainment, private-use goods,
  // Art. 54 LTVA limits). The VAT is still on the invoice but never enters
  // box 093 (deductible input VAT).
  LUX_17_NONDED:    { label: 'Luxembourg VAT 17% (non-deductible)', direction: 'incoming', vatRate: 0.17, description: 'LU VAT 17% that cannot be deducted (entertainment, private use, Art. 54 LTVA)' },

  // ════════════════════════════════════════════════════════════════════
  // INCOMING — Reverse-charge on services (self-assessed)
  // ════════════════════════════════════════════════════════════════════
  // Default-rate (17%) RC codes. The generic RC_EU_TAX / RC_NONEU_TAX
  // codes are the workhorse; the rate-specific variants below handle
  // reduced-rate services (district heating 8%, books/e-books 3%, etc.).
  // The reverse-charge mechanism uses the LU rate applicable to the
  // same supply if domestic (Art. 17§1 LTVA / Art. 196 Directive).
  RC_EU_TAX:        { label: 'RC EU Taxable 17%',  direction: 'incoming', vatRate: 0.17, description: 'Reverse charge, EU supplier, taxable in Luxembourg at 17% (Art. 17§1 LTVA)' },
  RC_EU_TAX_14:     { label: 'RC EU Taxable 14%',  direction: 'incoming', vatRate: 0.14, description: 'Reverse charge, EU supplier, reduced rate 14% applies domestically' },
  RC_EU_TAX_08:     { label: 'RC EU Taxable 8%',   direction: 'incoming', vatRate: 0.08, description: 'Reverse charge, EU supplier, reduced rate 8% applies (district heating, sports)' },
  RC_EU_TAX_03:     { label: 'RC EU Taxable 3%',   direction: 'incoming', vatRate: 0.03, description: 'Reverse charge, EU supplier, super-reduced 3% applies (books, e-books, certain foodstuffs)' },
  RC_EU_EX:         { label: 'RC EU Exempt',       direction: 'incoming', vatRate: null, description: 'Reverse charge, EU supplier, exempt under Art. 44 (qualifying fund recipient)' },
  RC_NONEU_TAX:     { label: 'RC Non-EU Taxable 17%', direction: 'incoming', vatRate: 0.17, description: 'Reverse charge, non-EU supplier, taxable in Luxembourg at 17%' },
  RC_NONEU_TAX_14:  { label: 'RC Non-EU Taxable 14%', direction: 'incoming', vatRate: 0.14, description: 'Reverse charge, non-EU supplier, reduced rate 14% applies' },
  RC_NONEU_TAX_08:  { label: 'RC Non-EU Taxable 8%',  direction: 'incoming', vatRate: 0.08, description: 'Reverse charge, non-EU supplier, reduced rate 8% applies' },
  RC_NONEU_TAX_03:  { label: 'RC Non-EU Taxable 3%',  direction: 'incoming', vatRate: 0.03, description: 'Reverse charge, non-EU supplier, super-reduced 3% applies' },
  RC_NONEU_EX:      { label: 'RC Non-EU Exempt',   direction: 'incoming', vatRate: null, description: 'Reverse charge, non-EU supplier, exempt under Art. 44' },

  // Domestic reverse-charge categories (Art. 61§2 LTVA / Art. 199 Directive)
  RC_LUX_CONSTR_17: { label: 'Domestic RC — construction 17%', direction: 'incoming', vatRate: 0.17, description: 'LU-to-LU construction, renovation, cleaning (Art. 61§2 c LTVA + RGD 21 décembre 1991)' },
  RC_LUX_SPEC_17:   { label: 'Domestic RC — scrap / emission 17%', direction: 'incoming', vatRate: 0.17, description: 'LU-to-LU scrap, waste, emission allowances, electricity wholesale (Art. 61§2 a-b LTVA)' },

  // Margin scheme — buyer has NO deduction right
  MARGIN_NONDED:    { label: 'Margin scheme (no deduction)', direction: 'incoming', vatRate: 0, description: 'Margin-scheme invoice (Art. 56bis LTVA / Art. 311-325 Directive): single gross amount, buyer cannot deduct' },

  // ════════════════════════════════════════════════════════════════════
  // INCOMING — Intra-Community acquisitions of goods (by rate)
  // ════════════════════════════════════════════════════════════════════
  // Generic IC_ACQ kept for backward compatibility; the rate-specific codes
  // below are preferred when the goods' applicable LU rate can be
  // determined (so the rate-split boxes 711/713/715/717 can be reported
  // accurately).
  IC_ACQ:           { label: 'IC Acquisition (rate unknown)', direction: 'incoming', vatRate: null, description: 'Intra-Community acquisition of goods (Art. 21 LTVA)' },
  IC_ACQ_17:        { label: 'IC Acquisition 17%', direction: 'incoming', vatRate: 0.17, description: 'IC acquisition, applicable LU rate 17%' },
  IC_ACQ_14:        { label: 'IC Acquisition 14%', direction: 'incoming', vatRate: 0.14, description: 'IC acquisition, applicable LU rate 14%' },
  IC_ACQ_08:        { label: 'IC Acquisition 8%',  direction: 'incoming', vatRate: 0.08, description: 'IC acquisition, applicable LU rate 8%' },
  IC_ACQ_03:        { label: 'IC Acquisition 3%',  direction: 'incoming', vatRate: 0.03, description: 'IC acquisition, applicable LU rate 3%' },

  // Import VAT paid at customs on non-EU goods. The VAT paid to customs is
  // deductible input VAT (box 077) if the goods are used for taxable
  // activity.
  IMPORT_VAT:       { label: 'Import VAT (non-EU goods)', direction: 'incoming', vatRate: null, description: 'Import of goods from outside the EU; VAT paid to customs (Art. 27 LTVA)' },

  // ════════════════════════════════════════════════════════════════════
  // INCOMING — Exemptions (Art. 44 sub-paragraphs, plain-language split)
  // ════════════════════════════════════════════════════════════════════
  // EXEMPT_44 is kept as the legacy generic code (equivalent to 44§1 d);
  // prefer the more specific sub-codes below when the basis is clear.
  EXEMPT_44:        { label: 'Exempt Art. 44 (fund management)', direction: 'incoming', vatRate: 0, description: 'Exempt under Art. 44§1 d LTVA (fund management) — default for legacy rows' },
  EXEMPT_44A_FIN:   { label: 'Exempt Art. 44§1 (a) — Financial', direction: 'incoming', vatRate: 0, description: 'Financial services exemption (banking, insurance, securities)' },
  EXEMPT_44B_RE:    { label: 'Exempt Art. 44§1 (b) — Real estate letting', direction: 'incoming', vatRate: 0, description: 'Exempt letting of immovable property (Art. 44§1 b LTVA)' },

  // ════════════════════════════════════════════════════════════════════
  // INCOMING — Out of scope / pass-through
  // ════════════════════════════════════════════════════════════════════
  OUT_SCOPE:        { label: 'Out of Scope', direction: 'incoming', vatRate: 0, description: 'Out of scope (Chamber of Commerce cotisation, CSSF subscription fee, stamp duty)' },
  DEBOURS:          { label: 'Disbursement (débours)', direction: 'incoming', vatRate: 0, description: 'Pure pass-through disbursement at cost (Art. 28§3 c LTVA)' },
  VAT_GROUP_OUT:    { label: 'VAT Group (out of scope)', direction: 'incoming', vatRate: 0, description: 'Supply within a Luxembourg VAT group (Art. 60ter LTVA) — no VAT consequence' },
  BAD_DEBT_RELIEF:  { label: 'Bad-debt relief (regularisation)', direction: 'incoming', vatRate: null, description: 'VAT regularisation on definitively uncollectible receivable (Art. 62 LTVA)' },

  // ════════════════════════════════════════════════════════════════════
  // OUTGOING
  // ════════════════════════════════════════════════════════════════════
  OUT_LUX_00:       { label: 'Outgoing Art. 44 Exempt', direction: 'outgoing', vatRate: 0, description: 'Outgoing, Art. 44 exempt (management fee to Lux fund)' },
  // Rate-specific taxable outgoing. The audit (agent E-2) flagged that a
  // fund structure with a 14% / 8% / 3% outgoing supply had no valid code
  // — reviewers were forced to pick OUT_LUX_17 (wrong rate, over-paid VAT)
  // or OUT_LUX_00 (wrong: not exempt, under-paid VAT).
  OUT_LUX_17:       { label: 'Outgoing Lux VAT 17%',   direction: 'outgoing', vatRate: 0.17, description: 'Outgoing, LU VAT 17% (taxable management / consulting)' },
  OUT_LUX_14:       { label: 'Outgoing Lux VAT 14%',   direction: 'outgoing', vatRate: 0.14, description: 'Outgoing, LU VAT 14% (intermediate rate, depositary-type services on the outgoing side)' },
  OUT_LUX_08:       { label: 'Outgoing Lux VAT 8%',    direction: 'outgoing', vatRate: 0.08, description: 'Outgoing, LU VAT 8% (reduced rate, specific services on the outgoing side)' },
  OUT_LUX_03:       { label: 'Outgoing Lux VAT 3%',    direction: 'outgoing', vatRate: 0.03, description: 'Outgoing, LU VAT 3% (super-reduced rate, specific categories)' },
  OUT_LUX_17_OPT:   { label: 'Outgoing 17% (Art. 45 opt-in)', direction: 'outgoing', vatRate: 0.17, description: 'Real-estate letting taxed by option under Art. 45 LTVA' },
  OUT_EU_RC:        { label: 'Outgoing EU RC (B2B services)', direction: 'outgoing', vatRate: null, description: 'B2B service to EU customer — customer self-assesses VAT (Art. 17 EU VAT Directive)' },
  OUT_IC_GOODS:     { label: 'Outgoing IC supply of goods', direction: 'outgoing', vatRate: 0, description: 'Intra-Community supply of goods to EU VAT-registered customer (Art. 43 LTVA)' },
  OUT_LU_TRIANG:    { label: 'Outgoing Triangulation', direction: 'outgoing', vatRate: 0, description: 'Triangulation simplification, intermediate supplier (Art. 18bis LTVA)' },
  OUT_NONEU:        { label: 'Outgoing non-EU customer', direction: 'outgoing', vatRate: 0, description: 'Service or goods to non-EU customer — outside the scope of LU VAT' },
  AUTOLIV_17:       { label: 'Autolivraison 17%', direction: 'outgoing', vatRate: 0.17, description: 'Self-supply / autolivraison at 17% (Art. 12 LTVA)' },
  OUT_OSS:          { label: 'Outgoing — OSS / IOSS (filed separately)', direction: 'outgoing', vatRate: null, description: 'B2C electronic / TBE services to EU consumers reported via OSS; NOT on the LU return boxes (Dir 2017/2455 / LTVA Art. 17bis)' },
  PLATFORM_DEEMED:  { label: 'Platform deemed supplier', direction: 'outgoing', vatRate: null, description: 'Digital platform deemed the supplier for VAT purposes (Art. 9a Reg. 282/2011; Versãofast T-657/24; Fenix C-695/20)' },
} as const;

export type TreatmentCode = keyof typeof TREATMENT_CODES;

// Convenience arrays used by the UI dropdowns and the classifier. If you
// add a new code above, add it to the matching array below as well.
export const INCOMING_TREATMENTS: TreatmentCode[] = [
  'LUX_17', 'LUX_14', 'LUX_08', 'LUX_03', 'LUX_00', 'LUX_17_NONDED',
  'RC_EU_TAX', 'RC_EU_TAX_14', 'RC_EU_TAX_08', 'RC_EU_TAX_03', 'RC_EU_EX',
  'RC_NONEU_TAX', 'RC_NONEU_TAX_14', 'RC_NONEU_TAX_08', 'RC_NONEU_TAX_03', 'RC_NONEU_EX',
  'RC_LUX_CONSTR_17', 'RC_LUX_SPEC_17',
  'IC_ACQ', 'IC_ACQ_17', 'IC_ACQ_14', 'IC_ACQ_08', 'IC_ACQ_03',
  'IMPORT_VAT',
  'EXEMPT_44', 'EXEMPT_44A_FIN', 'EXEMPT_44B_RE',
  'MARGIN_NONDED',
  'OUT_SCOPE', 'DEBOURS', 'VAT_GROUP_OUT', 'BAD_DEBT_RELIEF',
];

export const OUTGOING_TREATMENTS: TreatmentCode[] = [
  'OUT_LUX_00',
  'OUT_LUX_17', 'OUT_LUX_14', 'OUT_LUX_08', 'OUT_LUX_03',
  'OUT_LUX_17_OPT',
  'OUT_EU_RC', 'OUT_IC_GOODS', 'OUT_LU_TRIANG', 'OUT_NONEU',
  'AUTOLIV_17',
  'OUT_OSS', 'PLATFORM_DEEMED',
];
