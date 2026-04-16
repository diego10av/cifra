// ════════════════════════════════════════════════════════════════════════
// Legal sources — the living legal reference map of the platform.
//
// Every classification rule, treatment code, eCDF box and agent prompt
// that embeds a legal position MUST cite one or more ids from this file.
// This turns plain-text legal citations ("Art. 44§1 d LTVA") into
// structured references that the UI can hyperlink, the legal-watch
// system can flag for review, and downstream audit trails can prove.
//
// How to update this file:
//   1.  When the AED publishes a new circular, add an entry under CIRCULARS.
//   2.  When a CJEU decision lands that affects LU VAT practice, add it
//       under CASES_EU.
//   3.  When a Luxembourg Tribunal administratif / Cour administrative
//       ruling changes AED administrative practice, add it under CASES_LU.
//   4.  When law itself changes (LTVA amendment, Directive amendment),
//       update the `effective` range and the `superseded_by` link.
//   5.  Bump `last_reviewed` on any entry you have confirmed is still
//       current. The legal-watch report lists everything whose
//       last_reviewed is more than 12 months old.
//
// Principle: an internal tool for VAT work at Magic-Circle level is only
// as good as the rigour of its legal references. Never cite a statute
// without a structured source id; never let a source id rot.
// ════════════════════════════════════════════════════════════════════════

export interface LegalSource {
  id: string;                     // canonical id used by rules/boxes/prompts
  kind: 'law' | 'directive' | 'regulation' | 'circular' | 'case_eu' | 'case_lu' | 'practice';
  title: string;                  // short human-readable label
  citation: string;               // full formal citation
  article?: string;               // article or paragraph reference
  jurisdiction: 'LU' | 'EU' | 'LU+EU';
  effective_from?: string;        // ISO date when the source first took effect
  effective_until?: string | null;// ISO date when superseded, or null if still in force
  superseded_by?: string;         // legal-source id of the newer instrument, if any
  subject: string;                // one-line summary of what it regulates
  relevance: string;              // why it matters for this tool
  last_reviewed: string;          // ISO date the maintainer confirmed this is still current
  sources_url?: string;           // link to official text (legilux.lu / eur-lex / curia.europa.eu / etc.)
  notes?: string;                 // free text — practitioner commentary
}

// ────────────────────────── Primary Luxembourg law ──────────────────────────
export const LU_LAW: Record<string, LegalSource> = {
  LTVA: {
    id: 'LTVA',
    kind: 'law',
    title: 'Loi sur la TVA (LTVA)',
    citation: 'Loi du 12 février 1979 concernant la taxe sur la valeur ajoutée, telle que modifiée',
    jurisdiction: 'LU',
    effective_from: '1979-02-12',
    effective_until: null,
    subject: 'Primary Luxembourg VAT law — rates, exemptions, chargeability, deduction, filing',
    relevance: 'Every classification rule and eCDF box ultimately cites a LTVA article. This is the master law.',
    last_reviewed: '2026-04-16',
    sources_url: 'https://legilux.public.lu',
    notes: 'Amended dozens of times. When citing specific articles, prefer the current consolidated version on legilux.',
  },
  LTVA_ART_2: {
    id: 'LTVA_ART_2',
    kind: 'law', title: 'LTVA Art. 2 — scope of VAT',
    citation: 'Loi TVA, article 2',
    article: '2',
    jurisdiction: 'LU', effective_until: null,
    subject: 'Defines the scope: supplies of goods and services effected for consideration by a taxable person acting as such.',
    relevance: 'Baseline test for OUT_SCOPE / VAT_GROUP_OUT classifications.',
    last_reviewed: '2026-04-16',
  },
  LTVA_ART_12: {
    id: 'LTVA_ART_12',
    kind: 'law', title: 'LTVA Art. 12 — self-supply (autolivraison)',
    citation: 'Loi TVA, article 12',
    article: '12',
    jurisdiction: 'LU', effective_until: null,
    subject: 'Deemed supplies of goods and services for consideration (application to own use, private use of business assets).',
    relevance: 'Legal basis for treatment AUTOLIV_17.',
    last_reviewed: '2026-04-16',
  },
  LTVA_ART_17: {
    id: 'LTVA_ART_17',
    kind: 'law', title: 'LTVA Art. 17 — place of supply of services (general B2B rule)',
    citation: 'Loi TVA, article 17§1',
    article: '17§1',
    jurisdiction: 'LU', effective_until: null,
    subject: 'General B2B rule: place of supply is where the customer is established. Grounds the reverse charge.',
    relevance: 'Legal basis for RC_EU_TAX and RC_NONEU_TAX.',
    last_reviewed: '2026-04-16',
  },
  LTVA_ART_18BIS: {
    id: 'LTVA_ART_18BIS',
    kind: 'law', title: 'LTVA Art. 18bis — triangulation simplification',
    citation: 'Loi TVA, article 18bis',
    article: '18bis',
    jurisdiction: 'LU', effective_until: null,
    subject: 'Simplification for intra-Community triangular transactions (3 parties, 2 countries, 1 movement).',
    relevance: 'Legal basis for OUT_LU_TRIANG.',
    last_reviewed: '2026-04-16',
  },
  LTVA_ART_21: {
    id: 'LTVA_ART_21',
    kind: 'law', title: 'LTVA Art. 21 — intra-Community acquisitions',
    citation: 'Loi TVA, article 21',
    article: '21',
    jurisdiction: 'LU', effective_until: null,
    subject: 'Defines and taxes the intra-Community acquisition of goods by LU taxable persons.',
    relevance: 'Legal basis for IC_ACQ family of treatments and boxes 051/056/711-717.',
    last_reviewed: '2026-04-16',
  },
  LTVA_ART_27: {
    id: 'LTVA_ART_27',
    kind: 'law', title: 'LTVA Art. 27 — import of goods',
    citation: 'Loi TVA, article 27',
    article: '27',
    jurisdiction: 'LU', effective_until: null,
    subject: 'Taxation of goods imported from outside the EU; chargeability at customs clearance.',
    relevance: 'Legal basis for IMPORT_VAT. Links to Art. 57-58 (deduction of import VAT).',
    last_reviewed: '2026-04-16',
  },
  LTVA_ART_28: {
    id: 'LTVA_ART_28',
    kind: 'law', title: 'LTVA Art. 28§3 c — exclusion of disbursements from the taxable amount',
    citation: 'Loi TVA, article 28§3 c',
    article: '28§3 c',
    jurisdiction: 'LU', effective_until: null,
    subject: 'Amounts received by the supplier from the customer as repayment of expenses paid in the customer\'s name and for his account are excluded from the taxable amount.',
    relevance: 'Legal basis for DEBOURS treatment.',
    last_reviewed: '2026-04-16',
  },
  LTVA_ART_40: {
    id: 'LTVA_ART_40',
    kind: 'law', title: 'LTVA Art. 40 — standard rate',
    citation: 'Loi TVA, article 40',
    article: '40',
    jurisdiction: 'LU', effective_until: null,
    subject: 'Standard rate of VAT (17% from 2024).',
    relevance: 'Legal basis for LUX_17, OUT_LUX_17, AUTOLIV_17.',
    last_reviewed: '2026-04-16',
    notes: 'Rate was 16% (2023 budget temporary measure) and reverted to 17% from 2024-01-01.',
  },
  LTVA_ART_40_1: {
    id: 'LTVA_ART_40_1',
    kind: 'law', title: 'LTVA Art. 40-1 — reduced rates',
    citation: 'Loi TVA, article 40-1',
    article: '40-1',
    jurisdiction: 'LU', effective_until: null,
    subject: 'Intermediate (14%), reduced (8%) and super-reduced (3%) rates with their annexes.',
    relevance: 'Legal basis for LUX_14, LUX_08, LUX_03 and the rate-variants of IC_ACQ.',
    last_reviewed: '2026-04-16',
  },
  LTVA_ART_43: {
    id: 'LTVA_ART_43',
    kind: 'law', title: 'LTVA Art. 43 — IC supply of goods',
    citation: 'Loi TVA, article 43',
    article: '43',
    jurisdiction: 'LU', effective_until: null,
    subject: 'Zero-rating (exempt with credit) of intra-Community supplies of goods to VAT-registered EU customers.',
    relevance: 'Legal basis for OUT_IC_GOODS.',
    last_reviewed: '2026-04-16',
  },
  LTVA_ART_44: {
    id: 'LTVA_ART_44',
    kind: 'law', title: 'LTVA Art. 44 — exemptions',
    citation: 'Loi TVA, article 44',
    article: '44',
    jurisdiction: 'LU', effective_until: null,
    subject: 'Exemptions without right of deduction — financial (44§1 a), real estate (44§1 b), medical (44§1 c), fund management (44§1 d), etc.',
    relevance: 'Legal basis for LUX_00, EXEMPT_44, EXEMPT_44A_FIN, EXEMPT_44B_RE, RC_EU_EX, RC_NONEU_EX, OUT_LUX_00.',
    last_reviewed: '2026-04-16',
    notes: 'The fund-management exemption (44§1 d) transposes Art. 135(1)(g) of EU Directive 2006/112/EC. Scope is actively developed by the CJEU — see CASES_EU.',
  },
  LTVA_ART_45: {
    id: 'LTVA_ART_45',
    kind: 'law', title: 'LTVA Art. 45 — opt-in to tax real-estate letting',
    citation: 'Loi TVA, article 45',
    article: '45',
    jurisdiction: 'LU', effective_until: null,
    subject: 'Option for the lessor to tax real-estate letting (between VAT-registered taxable persons, mostly B2B).',
    relevance: 'Legal basis for OUT_LUX_17_OPT.',
    last_reviewed: '2026-04-16',
  },
  LTVA_ART_54: {
    id: 'LTVA_ART_54',
    kind: 'law', title: 'LTVA Art. 54 — excluded deductions',
    citation: 'Loi TVA, article 54',
    article: '54',
    jurisdiction: 'LU', effective_until: null,
    subject: 'Restrictions on input VAT deduction for passenger cars, entertainment, gifts, etc.',
    relevance: 'Legal basis for LUX_17_NONDED.',
    last_reviewed: '2026-04-16',
  },
  LTVA_ART_60TER: {
    id: 'LTVA_ART_60TER',
    kind: 'law', title: 'LTVA Art. 60ter — VAT group',
    citation: 'Loi TVA, article 60ter',
    article: '60ter',
    jurisdiction: 'LU', effective_until: null,
    subject: 'Optional LU VAT group regime (introduced 2018) — supplies within the group are outside the scope of VAT.',
    relevance: 'Legal basis for VAT_GROUP_OUT.',
    last_reviewed: '2026-04-16',
  },
  LTVA_ART_61: {
    id: 'LTVA_ART_61',
    kind: 'law', title: 'LTVA Art. 61 — invoice content requirements',
    citation: 'Loi TVA, article 61',
    article: '61',
    jurisdiction: 'LU', effective_until: null,
    subject: 'Mandatory content of a valid LU invoice (issuer/customer, VAT numbers, date, description, taxable amount, rate, VAT amount).',
    relevance: 'Guides the extractor prompt — what fields to extract for deduction support.',
    last_reviewed: '2026-04-16',
  },
  LTVA_ART_62: {
    id: 'LTVA_ART_62',
    kind: 'law', title: 'LTVA Art. 62 — self-billing and bad-debt relief',
    citation: 'Loi TVA, article 62',
    article: '62',
    jurisdiction: 'LU', effective_until: null,
    subject: 'Self-billing agreement requirements; regularisation of VAT on uncollectible receivables.',
    relevance: 'Legal basis for BAD_DEBT_RELIEF and for the "facturation par le preneur" extractor guidance.',
    last_reviewed: '2026-04-16',
  },
  LTVA_ART_65: {
    id: 'LTVA_ART_65',
    kind: 'law', title: 'LTVA Art. 65 — credit notes',
    citation: 'Loi TVA, article 65',
    article: '65',
    jurisdiction: 'LU', effective_until: null,
    subject: 'Content and timing requirements for credit notes (reference to original invoice, explicit correction).',
    relevance: 'Guides the is_credit_note extractor logic.',
    last_reviewed: '2026-04-16',
  },
};

// ────────────────────────── EU primary legislation ──────────────────────────
export const EU_LAW: Record<string, LegalSource> = {
  DIR_2006_112: {
    id: 'DIR_2006_112',
    kind: 'directive', title: 'EU VAT Directive',
    citation: 'Council Directive 2006/112/EC of 28 November 2006 on the common system of value added tax',
    jurisdiction: 'EU', effective_from: '2007-01-01', effective_until: null,
    subject: 'EU-wide common VAT system; every LTVA exemption article transposes a Directive article.',
    relevance: 'Cited in reasons alongside LTVA references. Art. 135(1)(g) fund management is the most important for this tool.',
    last_reviewed: '2026-04-16',
    sources_url: 'https://eur-lex.europa.eu/eli/dir/2006/112/oj',
  },
  DIR_2006_112_ART_135_1_G: {
    id: 'DIR_2006_112_ART_135_1_G',
    kind: 'directive', title: 'Directive Art. 135(1)(g) — management of special investment funds',
    citation: 'Directive 2006/112/EC, Art. 135(1)(g)',
    article: '135(1)(g)',
    jurisdiction: 'EU', effective_until: null,
    subject: 'Exemption for the management of special investment funds as defined by Member States.',
    relevance: 'The source of LTVA Art. 44§1 d. Scope actively developed by CJEU — see CASES_EU.BLACKROCK, CASES_EU.FISCALE_EENHEID_X.',
    last_reviewed: '2026-04-16',
  },
  REG_282_2011: {
    id: 'REG_282_2011',
    kind: 'regulation', title: 'EU Implementing Regulation 282/2011',
    citation: 'Council Implementing Regulation (EU) 282/2011',
    jurisdiction: 'EU', effective_from: '2011-07-01', effective_until: null,
    subject: 'Implementation rules on place of supply, taxable persons, evidentiary presumptions.',
    relevance: 'Reference for direction / place-of-supply logic in the classifier.',
    last_reviewed: '2026-04-16',
  },
  REG_904_2010: {
    id: 'REG_904_2010',
    kind: 'regulation', title: 'EU Regulation 904/2010 — Administrative cooperation (VIES)',
    citation: 'Council Regulation (EU) 904/2010',
    jurisdiction: 'EU', effective_from: '2012-01-01', effective_until: null,
    subject: 'Administrative cooperation between Member States; VIES infrastructure; real-time VAT-number validation.',
    relevance: 'Grounds the obligation to validate a customer VAT number via VIES before treating an outgoing line as OUT_EU_RC. Art. 31 = real-time validation; Chapter X = Eurofisc fraud network.',
    last_reviewed: '2026-04-16',
  },
  DIR_2020_285: {
    id: 'DIR_2020_285',
    kind: 'directive', title: 'Directive 2020/285 — small-business scheme',
    citation: 'Council Directive (EU) 2020/285',
    jurisdiction: 'EU', effective_from: '2025-01-01', effective_until: null,
    subject: 'Reform of the SME VAT exemption; cross-border €100k EU threshold + national thresholds (€50k in LU).',
    relevance: 'Triggers RULE 23 (LU Art. 57 franchise). Fund entities are rarely eligible because of reverse-charge inputs — the classifier does not route to franchise by default.',
    last_reviewed: '2026-04-16',
  },
  DIR_2022_542: {
    id: 'DIR_2022_542',
    kind: 'directive', title: 'Directive 2022/542 — rates reform',
    citation: 'Council Directive (EU) 2022/542',
    jurisdiction: 'EU', effective_from: '2025-01-01', effective_until: null,
    subject: 'Revised Annex III (reduced-rate categories) and new super-reduced categories.',
    relevance: 'LU implementation affects which supplies fall into 14% / 8% / 3% (LUX_14 / LUX_08 / LUX_03 treatments).',
    last_reviewed: '2026-04-16',
  },
  VIDA_PACKAGE: {
    id: 'VIDA_PACKAGE',
    kind: 'directive', title: 'ViDA — VAT in the Digital Age',
    citation: 'Council Directive (EU) 2025/516 + amending Regs 904/2010 and 282/2011 (adopted 11 March 2025)',
    jurisdiction: 'EU', effective_from: '2027-01-01', effective_until: null,
    subject: 'Three pillars: (1) platform economy deemed supplier from 2027, (2) single VAT registration extension 2028, (3) digital reporting + mandatory e-invoicing for intra-EU B2B from 2030.',
    relevance: 'Drives the eCDF XML evolution and replaces the état récapitulatif with near-real-time transaction reporting from 2030. The platform must track the XSD rebaseline timeline.',
    last_reviewed: '2026-04-16',
    notes: 'Timeline agreed by the Council 5 November 2024, formally adopted 11 March 2025. Exact OJ publication reference to be confirmed.',
  },
  CESOP: {
    id: 'CESOP',
    kind: 'directive', title: 'CESOP — cross-border payments reporting',
    citation: 'Directive (EU) 2020/284 + Regulation (EU) 2020/283',
    jurisdiction: 'EU', effective_from: '2024-01-01', effective_until: null,
    subject: 'Central Electronic System of Payment Information: PSPs must report cross-border payments to tax authorities.',
    relevance: 'Not a VAT-return obligation for the platform, but context — the AED may cross-reference CESOP data when auditing RC lines.',
    last_reviewed: '2026-04-16',
  },
};

// ────────────────────────── AED circulars ──────────────────────────
// Maintainer: keep `last_reviewed` current. An entry whose last_reviewed is
// more than 12 months old is listed by the legal-watch report as "to
// reconfirm". When the AED publishes a replacement, add the new circular
// here with superseded_by pointing to the old id, then set the old one's
// effective_until to the new one's effective_from.
export const CIRCULARS: Record<string, LegalSource> = {
  // ⚠ Circular numbers below are from practitioner memory. Each is flagged
  // with a `notes` entry when the exact number requires verification
  // against the current AED site. The /docs/legal-watch-triage.md file
  // tracks the verification backlog.
  CIRC_723: {
    id: 'CIRC_723',
    kind: 'circular', title: 'Circ. 723 — Management of special investment funds',
    citation: 'AED Circulaire n° 723 (originally 2006, updated multiple times)',
    jurisdiction: 'LU', effective_until: null,
    subject: 'Defines which activities constitute "management" for Art. 44§1 d LTVA / Art. 135(1)(g) Directive.',
    relevance: 'Baseline for the classifier\'s RULES 7 / 10 / 12 and INFERENCE C / D. Every fund-management exemption rule cites Circ. 723.',
    last_reviewed: '2026-04-16',
    notes: 'Exact current number and last-update date to be confirmed on the AED site. A Circ. 723bis or "Circ. 723 (updated 2017)" extended scope post ATP PensionService and Fiscale Eenheid X. Post-DBKAG/K consolidation expected but not yet issued as of 2026-Q1.',
  },
  CIRC_764: {
    id: 'CIRC_764',
    kind: 'circular', title: 'Circ. 764 — Financial exemption (Art. 44§1 a–f)',
    citation: 'AED Circulaire n° 764',
    jurisdiction: 'LU', effective_until: null,
    subject: 'Scope of Art. 44§1 a–f LTVA on credit, securities, currency, and (separately) domiciliation services.',
    relevance: 'Drives EXEMPT_44A_FIN classification and — critically — the RULE 5D override that classifies domiciliation as TAXABLE 17% (not a real-estate letting).',
    last_reviewed: '2026-04-16',
    notes: 'Confirm number against AED.',
  },
  CIRC_810: {
    id: 'CIRC_810',
    kind: 'circular', title: 'Circ. 810 — Real-estate letting and option to tax',
    citation: 'AED Circulaire n° 810',
    jurisdiction: 'LU', effective_until: null,
    subject: 'Scope of Art. 44§1 b exemption and the Art. 45 option to tax; post-Titanium clarifications on fixed establishment for passive property-cos.',
    relevance: 'Drives RULE 5 (letting → LUX_00), RULE 5C (carve-out → taxable), RULE 15A (Art. 45 opt-in on 17% outgoing).',
    last_reviewed: '2026-04-16',
    notes: 'A Circ. 810-bis or supplemental note is believed to codify the post-Titanium FE position — confirm exact reference.',
  },
  CIRC_798_VAT_GROUP: {
    id: 'CIRC_798_VAT_GROUP',
    kind: 'circular', title: 'Circ. on VAT group (Art. 60ter)',
    citation: 'AED Circulaire (no. to confirm; likely 798 or 781)',
    jurisdiction: 'LU', effective_from: '2018-07-31', effective_until: null,
    subject: 'Implementation of the LU VAT group regime (Loi du 6 août 2018 adding Art. 60ter LTVA).',
    relevance: 'Grounds treatment VAT_GROUP_OUT. Supplies between members of a LU VAT group are outside the scope of VAT, confirmed by CJEU Finanzamt T II (C-184/23).',
    last_reviewed: '2026-04-16',
    notes: 'Exact circular number to confirm.',
  },
  CIRC_706_INVOICING: {
    id: 'CIRC_706_INVOICING',
    kind: 'circular', title: 'Circ. 706 — Invoicing requirements under Art. 61 LTVA',
    citation: 'AED Circulaire n° 706',
    jurisdiction: 'LU', effective_until: null,
    subject: 'Mandatory content of a valid LU invoice; electronic invoicing format; retention and archival requirements.',
    relevance: 'Referenced by the extractor prompt\'s invoice_validity_missing_fields check and by the drafter\'s disclaimer.',
    last_reviewed: '2026-04-16',
  },
  CIRC_759_IMPORT: {
    id: 'CIRC_759_IMPORT',
    kind: 'circular', title: 'Circ. 759 — Import VAT procedure (postponed accounting)',
    citation: 'AED Circulaire n° 759',
    jurisdiction: 'LU', effective_until: null,
    subject: 'Import VAT procedure, including the "report de paiement" (postponed accounting) mechanism for VAT-registered importers.',
    relevance: 'Grounds the flag-only RULE 19 IMPORT_VAT treatment — the deductible import VAT must come from the customs declaration (DAU), not the supplier\'s commercial invoice.',
    last_reviewed: '2026-04-16',
    notes: 'Confirm exact number.',
  },
  CSSF_18_698_DEPOSITARY: {
    id: 'CSSF_18_698_DEPOSITARY',
    kind: 'circular', title: 'CSSF Circ. 18/698 — Depositary duties conceptual split',
    citation: 'CSSF Circulaire 18/698',
    jurisdiction: 'LU', effective_until: null,
    subject: 'Depositary duties under the AIFMD framework (safekeeping, oversight, cash-flow monitoring).',
    relevance: 'Informs the depositary-fee split heuristic in the extractor prompt and the default 17% treatment in PRACTICE.DEPOSITARY_SPLIT.',
    last_reviewed: '2026-04-16',
  },
};

// ────────────────────────── CJEU and EU General Court ──────────────────────
export const CASES_EU: Record<string, LegalSource> = {
  VERSAOFAST: {
    id: 'VERSAOFAST',
    kind: 'case_eu', title: 'Versãofast — referral fees and fund management exemption',
    citation: 'General Court, T-657/24, 26 November 2025',
    jurisdiction: 'EU', effective_from: '2025-11-26', effective_until: null,
    subject: 'Treatment of referral fees paid to a non-LU intermediary by a LU fund as exempt under Art. 135(1)(g) / LTVA Art. 44§1 d.',
    relevance: 'Cited by the drafter prompt as an example of a legal-position flag.',
    last_reviewed: '2026-04-16',
    notes: 'See also AG opinion (2025-06) and the LU Administration\'s position on non-amendment of prior-year returns.',
  },
  BLACKROCK: {
    id: 'BLACKROCK',
    kind: 'case_eu', title: 'BlackRock Investment Management (UK) — scope of fund-management exemption',
    citation: 'CJEU, C-231/19, 2 July 2020',
    jurisdiction: 'EU', effective_from: '2020-07-02', effective_until: null,
    subject: 'A single indivisible supply of IT services to a fund manager is not exempt under Art. 135(1)(g) Directive — the exemption is narrow.',
    relevance: 'The cornerstone for INFERENCE C/D exclusion keywords and for RULES 10/12 entity-type guard. A supply must be "specific and essential to fund management" — IT licences, SaaS, training, legal/tax/audit services are NOT.',
    last_reviewed: '2026-04-16',
  },
  FISCALE_EENHEID_X: {
    id: 'FISCALE_EENHEID_X',
    kind: 'case_eu', title: 'Fiscale Eenheid X — boundary of "special investment funds"',
    citation: 'CJEU, C-595/13, 9 December 2015',
    jurisdiction: 'EU', effective_from: '2015-12-09', effective_until: null,
    subject: 'Defines the comparability test for what counts as a "special investment fund" under Art. 135(1)(g). An entity must be subject to specific state supervision and comparable to a UCITS.',
    relevance: 'Grounds the "qualifying fund" restriction in RULES 10/12 — only funds meeting this test get Art. 44§1 d treatment on incoming services.',
    last_reviewed: '2026-04-16',
  },
  ATP_PENSION: {
    id: 'ATP_PENSION',
    kind: 'case_eu', title: 'ATP Pension Service — pension funds as special investment funds',
    citation: 'CJEU, C-464/12, 13 March 2014',
    jurisdiction: 'EU', effective_from: '2014-03-13', effective_until: null,
    subject: 'Certain occupational-pension funds qualify as "special investment funds" for Art. 135(1)(g).',
    relevance: 'Expands the qualifying-fund perimeter beyond UCITS to include comparable pension vehicles.',
    last_reviewed: '2026-04-16',
  },
  DBKAG: {
    id: 'DBKAG',
    kind: 'case_eu', title: 'DBKAG / K — outsourced fund administration and tax services',
    citation: 'CJEU, C-58/20 & C-59/20, 17 June 2021',
    jurisdiction: 'EU', effective_from: '2021-06-17', effective_until: null,
    subject: 'Outsourced fund-admin services (including software-based NAV calculation) can fall within Art. 135(1)(g) if "specific and essential". Tax-advice services do not.',
    relevance: 'Grounds the expanded FUND_MGMT_KEYWORDS list (NAV calculation, fund administration, RTA, depositary services). Also validates the exclusion list (tax advisory = taxable).',
    last_reviewed: '2026-04-16',
  },
  DEUTSCHE_BANK: {
    id: 'DEUTSCHE_BANK',
    kind: 'case_eu', title: 'Deutsche Bank — narrow reading of the financial exemption',
    citation: 'CJEU, C-44/11, 19 July 2012',
    jurisdiction: 'EU', effective_from: '2012-07-19', effective_until: null,
    subject: 'Discretionary portfolio management combining investment advice and execution is taxable — neither a composite exempt financial service nor within the fund-management exemption.',
    relevance: 'Cited by INFERENCE E taxable backstop to prevent financial-adjacent keywords from over-exempting.',
    last_reviewed: '2026-04-16',
  },
  MORGAN_STANLEY: {
    id: 'MORGAN_STANLEY',
    kind: 'case_eu', title: 'Morgan Stanley — cross-border head-office / branch deduction',
    citation: 'CJEU, C-165/17, 24 January 2019',
    jurisdiction: 'EU', effective_from: '2019-01-24', effective_until: null,
    subject: 'Deduction right of a branch providing services to its head office; the deduction fraction depends on the mix of taxable and exempt supplies at both levels.',
    relevance: 'Relevant to LU entities with non-LU branches / head offices when computing pro-rata for box 095.',
    last_reviewed: '2026-04-16',
  },
  SKANDIA: {
    id: 'SKANDIA',
    kind: 'case_eu', title: 'Skandia America — cross-border VAT group supplies',
    citation: 'CJEU, C-7/13, 17 September 2014',
    jurisdiction: 'EU', effective_from: '2014-09-17', effective_until: null,
    subject: 'A supply from a non-EU head office to an EU VAT-group branch is taxable (the branch is not part of the head-office taxable person when it is in a VAT group).',
    relevance: 'Relevant to VAT_GROUP_OUT classification when the LU group has non-EU head-office relationships.',
    last_reviewed: '2026-04-16',
  },
  DANSKE_BANK: {
    id: 'DANSKE_BANK',
    kind: 'case_eu', title: 'Danske Bank — intra-EU VAT group supplies',
    citation: 'CJEU, C-812/19, 11 March 2021',
    jurisdiction: 'EU', effective_from: '2021-03-11', effective_until: null,
    subject: 'Similar to Skandia: a supply from a branch outside the VAT group (in another MS) to a branch in the group is taxable.',
    relevance: 'Same as Skandia for intra-EU arrangements.',
    last_reviewed: '2026-04-16',
  },
  FINANZAMT_T: {
    id: 'FINANZAMT_T',
    kind: 'case_eu', title: 'Finanzamt T — VAT groups confirmed',
    citation: 'CJEU, C-269/20, 1 December 2022',
    jurisdiction: 'EU', effective_from: '2022-12-01', effective_until: null,
    subject: 'Confirms that VAT groups exist in EU law and that supplies between members are disregarded.',
    relevance: 'Binds AED practice under Art. 60ter — supplies between LU VAT-group members are out of scope (not exempt).',
    last_reviewed: '2026-04-16',
  },
  FINANZAMT_T_II: {
    id: 'FINANZAMT_T_II',
    kind: 'case_eu', title: 'Finanzamt T II — intra-VAT-group supplies definitively out of scope',
    citation: 'CJEU, C-184/23, 11 July 2024',
    jurisdiction: 'EU', effective_from: '2024-07-11', effective_until: null,
    subject: 'Transactions between members of the VAT group are definitively NOT within the scope of VAT.',
    relevance: 'Definitive authority for VAT_GROUP_OUT classification. Closed the lingering legal uncertainty around internal supplies.',
    last_reviewed: '2026-04-16',
  },
  NORDDEUTSCHE: {
    id: 'NORDDEUTSCHE',
    kind: 'case_eu', title: 'Norddeutsche Gesellschaft für Diakonie — VAT group representative',
    citation: 'CJEU, C-141/20, 1 December 2022',
    jurisdiction: 'EU', effective_from: '2022-12-01', effective_until: null,
    subject: 'Compatibility of national VAT-group mechanisms with Art. 11 PVD; group representative as taxable person.',
    relevance: 'Procedural authority for the LU VAT group representative filing mechanism.',
    last_reviewed: '2026-04-16',
  },
  TITANIUM: {
    id: 'TITANIUM',
    kind: 'case_eu', title: 'Titanium — passive real-estate letting does not create a fixed establishment',
    citation: 'CJEU, C-931/19, 3 June 2021',
    jurisdiction: 'EU', effective_from: '2021-06-03', effective_until: null,
    subject: 'A passive property-letting activity with no LOCAL human resources does not constitute a fixed establishment for reverse-charge purposes.',
    relevance: 'Narrows the fixed-establishment perimeter for LU propcos owned by non-EU funds. Informs RULE 10X / 12X flag text.',
    last_reviewed: '2026-04-16',
  },
  CABOT_PLASTICS: {
    id: 'CABOT_PLASTICS',
    kind: 'case_eu', title: 'Cabot Plastics Belgium — exclusive intra-group tolling does not create FE',
    citation: 'CJEU, C-232/22, 29 June 2023',
    jurisdiction: 'EU', effective_from: '2023-06-29', effective_until: null,
    subject: 'A subsidiary providing services exclusively to its parent does not, on that basis alone, constitute a fixed establishment.',
    relevance: 'Reinforces Titanium. LU service-provider subsidiaries do not automatically create an FE of their foreign parent.',
    last_reviewed: '2026-04-16',
  },
  FENIX: {
    id: 'FENIX',
    kind: 'case_eu', title: 'Fenix International — platform deemed supplier',
    citation: 'CJEU, C-695/20, 28 February 2023',
    jurisdiction: 'EU', effective_from: '2023-02-28', effective_until: null,
    subject: 'Art. 9a of Reg. 282/2011 is valid — the platform is presumed the supplier for electronic services facilitated to consumers.',
    relevance: 'Foundational for ViDA\'s deemed-supplier rules. Fund-distribution platforms and syndicate platforms must consider Art. 9a.',
    last_reviewed: '2026-04-16',
  },
  KAPLAN: {
    id: 'KAPLAN',
    kind: 'case_eu', title: 'Kaplan International — cost-sharing exemption cross-border inapplicable',
    citation: 'CJEU, C-77/19, 18 November 2020',
    jurisdiction: 'EU', effective_from: '2020-11-18', effective_until: null,
    subject: 'Art. 132(1)(f) cost-sharing exemption does not apply cross-border; members must be in the same Member State.',
    relevance: 'Narrows the utility of independent-groups-of-persons (IGP / GIE) for LU fund administration with foreign members.',
    last_reviewed: '2026-04-16',
    notes: 'Extends the Aviva (C-605/15) and DNB Banka (C-326/15) line from 21 September 2017.',
  },
  MARLE_PARTICIPATIONS: {
    id: 'MARLE_PARTICIPATIONS',
    kind: 'case_eu', title: 'Marle Participations — holding-co active management',
    citation: 'CJEU, C-320/17, 5 July 2018',
    jurisdiction: 'EU', effective_from: '2018-07-05', effective_until: null,
    subject: 'A holding company letting immovable property to its subsidiary is engaged in an economic activity and entitled to deduct input VAT.',
    relevance: 'Informs the SOPARFI "active holding" entity classification and its input-VAT recovery profile.',
    last_reviewed: '2026-04-16',
  },
  LARENTIA_MINERVA: {
    id: 'LARENTIA_MINERVA',
    kind: 'case_eu', title: 'Larentia + Minerva — mixed holding deduction',
    citation: 'CJEU, C-108/14 and C-109/14, 16 July 2015',
    jurisdiction: 'EU', effective_from: '2015-07-16', effective_until: null,
    subject: 'A mixed holding company that provides services to subsidiaries can deduct input VAT on acquisition costs of those subsidiaries.',
    relevance: 'Grounds the SOPARFI deduction methodology when the holding also provides management / admin services.',
    last_reviewed: '2026-04-16',
  },
  GFBK: {
    id: 'GFBK',
    kind: 'case_eu', title: 'GfBk — continuous investment advisory can be fund management',
    citation: 'CJEU, C-275/11, 7 March 2013',
    jurisdiction: 'EU', effective_from: '2013-03-07', effective_until: null,
    subject: 'Continuous non-discretionary investment advisory which in practice drives portfolio decisions can qualify as "management".',
    relevance: 'Narrow but important — the classifier\'s RULE 10/12 must allow an advisory-agreement override when the adviser effectively makes portfolio decisions.',
    last_reviewed: '2026-04-16',
  },
  CSC_FINANCIAL: {
    id: 'CSC_FINANCIAL',
    kind: 'case_eu', title: 'CSC Financial Services — narrow reading of "negotiation"',
    citation: 'CJEU, C-235/00, 13 December 2001',
    jurisdiction: 'EU', effective_from: '2001-12-13', effective_until: null,
    subject: 'Negotiation of securities requires bringing specific parties to a specific contract, not generic information provision.',
    relevance: 'Grounds the market-practice treatment of referral fees and placement-agent commissions (taxable unless documented negotiation).',
    last_reviewed: '2026-04-16',
  },
  DTZ_ZADELHOFF: {
    id: 'DTZ_ZADELHOFF',
    kind: 'case_eu', title: 'DTZ Zadelhoff — negotiation / intermediation of securities',
    citation: 'CJEU, C-259/11, 5 July 2012',
    jurisdiction: 'EU', effective_from: '2012-07-05', effective_until: null,
    subject: 'Reinforces CSC Financial on the negotiation test under Art. 135(1)(f) Directive.',
    relevance: 'Same as CSC — cited by placement-agent / referral-fee practice.',
    last_reviewed: '2026-04-16',
  },
  HERST: {
    id: 'HERST',
    kind: 'case_eu', title: 'Herst — attribution of intra-EU transport in chain transactions',
    citation: 'CJEU, C-401/18, 23 April 2020',
    jurisdiction: 'EU', effective_from: '2020-04-23', effective_until: null,
    subject: 'Attribution of the intra-EU transport to a single supply in a chain is fact-sensitive, based on transport-risk allocation.',
    relevance: 'Relevant to fund-owned commodity / trading vehicles. Flag on multi-party chain transactions.',
    last_reviewed: '2026-04-16',
  },
};

// ────────────────────────── LU Tribunal administratif / Cour administrative ──
// ⚠ Lower confidence section. The LU VAT jurisprudence database (Legilux /
// JusCaf) is not fully machine-accessible; entries below are best-effort
// and MUST be verified against the Pasicrisie administrative before being
// relied on in a return. See /docs/legal-watch-triage.md for the
// verification backlog.
export const CASES_LU: Record<string, LegalSource> = {
  TA_SOPARFI_ACTIVE_HOLDING: {
    id: 'TA_SOPARFI_ACTIVE_HOLDING',
    kind: 'case_lu', title: 'TA — SOPARFI active-holding deduction',
    citation: 'Tribunal administratif de Luxembourg, rôle number TBD, 2017-2019',
    jurisdiction: 'LU', effective_until: null,
    subject: 'SOPARFI with active management of subsidiaries entitled to partial input-VAT recovery (LU transposition of Marle Participations / Larentia + Minerva).',
    relevance: 'Grounds the SOPARFI deduction-methodology choices in Option B rules.',
    last_reviewed: '2026-04-16',
    notes: 'Exact rôle number and date to confirm in Pasicrisie administrative.',
  },
  CA_ART_45_OPTION_FORMALITIES: {
    id: 'CA_ART_45_OPTION_FORMALITIES',
    kind: 'case_lu', title: 'CA — Art. 45 opt-in formalities are fatal',
    citation: 'Cour administrative, rôle TBD',
    jurisdiction: 'LU', effective_until: null,
    subject: 'The Art. 45 LTVA option to tax real-estate letting must be filed in advance and in the correct form — failure is fatal.',
    relevance: 'Informs the OUT_LUX_17_OPT treatment gating in the classifier and the reviewer UI flag.',
    last_reviewed: '2026-04-16',
    notes: 'Exact rôle number to confirm.',
  },
};

// ────────────────────────── Market practice (Big 4 / Magic Circle LU) ─────
// These are not law but prevailing professional consensus among the LU
// Big-4 / Magic Circle firms as of early 2026. Every entry here is cited
// explicitly when used in a classification reason — we do NOT present
// market practice as if it were law. When the AED publishes a circular
// that codifies or contradicts an item, update `superseded_by` and add
// the circular entry to CIRCULARS.
export const PRACTICE: Record<string, LegalSource> = {
  PRAC_REFERRAL_FEES: {
    id: 'PRAC_REFERRAL_FEES',
    kind: 'practice', title: 'Referral fees — default TAXABLE',
    citation: 'Big-4 / Magic Circle LU consensus post-CSC Financial (C-235/00), DTZ Zadelhoff (C-259/11)',
    jurisdiction: 'LU', effective_until: null,
    subject: 'Category-II referral fees are taxable at 17% unless the agreement evidences a negotiation mandate under Art. 44§1 f LTVA.',
    relevance: 'Default treatment in the classifier; reviewer flag when the contract expresses a documented negotiation mandate.',
    last_reviewed: '2026-04-16',
  },
  PRAC_CARRY_INTEREST: {
    id: 'PRAC_CARRY_INTEREST',
    kind: 'practice', title: 'Carry interest — default OUT OF SCOPE',
    citation: 'Market consensus (economic return on risk capital ≠ supply of services)',
    jurisdiction: 'LU', effective_until: null,
    subject: 'Carry payable to a GP who is also an investor: out of scope; a carry paid to a pure-service GP may re-characterise.',
    relevance: 'Guides the classifier to treat carry distributions as out-of-scope and flag pure-service GP arrangements.',
    last_reviewed: '2026-04-16',
  },
  PRAC_AIFM_DELEGATION: {
    id: 'PRAC_AIFM_DELEGATION',
    kind: 'practice', title: 'AIFM delegation fees — default EXEMPT',
    citation: 'AIFMD Art. 20 + CJEU BlackRock (C-231/19) and DBKAG (C-58/20)',
    jurisdiction: 'LU+EU', effective_until: null,
    subject: 'Fees for AIFM functions delegated under AIFMD Art. 20 to a qualifying delegate are exempt under Art. 44§1 d LTVA.',
    relevance: 'Drives the classifier to EXEMPT_44 when documented AIFMD delegation agreement is on file.',
    last_reviewed: '2026-04-16',
  },
  PRAC_INVESTMENT_ADVISORY: {
    id: 'PRAC_INVESTMENT_ADVISORY',
    kind: 'practice', title: 'Investment advisory (non-discretionary) — default TAXABLE',
    citation: 'CJEU GfBk (C-275/11) narrow reading',
    jurisdiction: 'LU+EU', effective_until: null,
    subject: 'Non-discretionary advisory is taxable. Only continuous advisory that in practice drives portfolio decisions qualifies as management (GfBk).',
    relevance: 'Default taxable; override to exempt only on evidence the adviser transfers portfolio decision-making.',
    last_reviewed: '2026-04-16',
  },
  PRAC_PLACEMENT_AGENT: {
    id: 'PRAC_PLACEMENT_AGENT',
    kind: 'practice', title: 'Placement-agent commissions — split TAXABLE (distribution) / EXEMPT (intermediation)',
    citation: 'CSC Financial (C-235/00), DTZ Zadelhoff (C-259/11)',
    jurisdiction: 'LU+EU', effective_until: null,
    subject: 'Distribution / marketing support is taxable; specific-negotiation / intermediation services are exempt under Art. 44§1 f LTVA.',
    relevance: 'Default taxable; reviewer override on explicit negotiation mandate. Typical Big-4 memo outcome is ~60% exempt / 40% taxable on a well-drafted agreement.',
    last_reviewed: '2026-04-16',
  },
  PRAC_DEPOSITARY_SPLIT: {
    id: 'PRAC_DEPOSITARY_SPLIT',
    kind: 'practice', title: 'Depositary fees — default TAXABLE 17% across all components',
    citation: 'AED practice; AIFMD Art. 21; CSSF Circ. 18/698',
    jurisdiction: 'LU', effective_until: null,
    subject: 'Safekeeping / custody / oversight / cash-flow monitoring are all taxable at the standard rate 17%. Not a 14% item despite common misconception.',
    relevance: 'The extractor prompt split table reflects this default; the classifier does not auto-route depositary fees to 14%.',
    last_reviewed: '2026-04-16',
    notes: 'Override only where the depositary contract positions the depositary as providing fund-management services (uncommon).',
  },
  PRAC_TRANSFER_AGENCY: {
    id: 'PRAC_TRANSFER_AGENCY',
    kind: 'practice', title: 'Transfer-agency fees — EXEMPT for qualifying funds',
    citation: 'CJEU ATP PensionService (C-464/12) + AED updated practice',
    jurisdiction: 'LU+EU', effective_until: null,
    subject: 'Transfer-agency services to a qualifying fund (UCITS, UCI Part II, SIF, RAIF, qualifying AIF) are exempt under Art. 44§1 d LTVA.',
    relevance: 'Default exempt when entity_type = fund; taxable otherwise.',
    last_reviewed: '2026-04-16',
  },
  PRAC_COINVESTMENT_VEHICLE: {
    id: 'PRAC_COINVESTMENT_VEHICLE',
    kind: 'practice', title: 'Co-investment vehicle management fees — depends on vehicle regulatory status',
    citation: 'Fiscale Eenheid X (C-595/13) criteria',
    jurisdiction: 'LU+EU', effective_until: null,
    subject: 'Exempt only if the co-investment vehicle qualifies as a special investment fund (SIF, RAIF, SICAR, UCI); otherwise taxable.',
    relevance: 'Reviewer decision point; no automatic classification.',
    last_reviewed: '2026-04-16',
  },
  PRAC_WATERFALL_DISTRIBUTION: {
    id: 'PRAC_WATERFALL_DISTRIBUTION',
    kind: 'practice', title: 'Waterfall distributions — OUT OF SCOPE',
    citation: 'Market consensus (return on investment ≠ supply)',
    jurisdiction: 'LU', effective_until: null,
    subject: 'Distributions through a fund\'s waterfall to GP / investors are out of scope. Structuring fees embedded in the waterfall may be taxable.',
    relevance: 'Default out-of-scope; reviewer flag for "structuring fees" line items.',
    last_reviewed: '2026-04-16',
  },
  PRAC_LU_STANDARD_RATE: {
    id: 'PRAC_LU_STANDARD_RATE',
    kind: 'practice', title: 'LU standard VAT rate — 17% since 2024-01-01',
    citation: 'Loi modifiée (restoration of the 17% rate from the 2023 temporary 16%)',
    jurisdiction: 'LU', effective_from: '2024-01-01', effective_until: null,
    subject: 'The LU standard rate returned to 17% on 2024-01-01 after the 2023 temporary reduction to 16%.',
    relevance: 'Anchor for LUX_17, OUT_LUX_17, AUTOLIV_17 and every 17%-rated box in ecdf-boxes.ts.',
    last_reviewed: '2026-04-16',
    notes: 'Historical: 2023-01-01 → 2023-12-31 the standard rate was 16%. Returns covering periods in 2023 must use 16%, not 17%.',
  },
};

// ────────────────────────── All sources flat map ──────────────────────────
export const ALL_LEGAL_SOURCES: Record<string, LegalSource> = {
  ...LU_LAW,
  ...EU_LAW,
  ...CIRCULARS,
  ...CASES_EU,
  ...CASES_LU,
  ...PRACTICE,
};

export type LegalSourceId = keyof typeof ALL_LEGAL_SOURCES;

/** Resolve a source id to the full entry (or undefined if unknown). */
export function resolveLegalSource(id: string): LegalSource | undefined {
  return ALL_LEGAL_SOURCES[id];
}

/** Return every source whose last_reviewed is older than `months` months. */
export function sourcesDueForReview(
  months = 12,
  now: Date = new Date(),
): LegalSource[] {
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - months);
  return Object.values(ALL_LEGAL_SOURCES)
    .filter(s => new Date(s.last_reviewed).getTime() < cutoff.getTime())
    .sort((a, b) => a.last_reviewed.localeCompare(b.last_reviewed));
}
