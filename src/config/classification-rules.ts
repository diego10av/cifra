// Deterministic VAT classification rules engine for Luxembourg.
//
// Classification priority (evaluated in this exact order, first match wins):
//   PRIORITY 1  user manual         → treatment_source='manual'  (NEVER touched here)
//   PRIORITY 2  direct-evidence     → Rules 1-7 and 9 (explicit rate, keyword match)
//   PRIORITY 3  precedent           → Prior year Excel match (blue)
//   PRIORITY 4  contextual inference→ Inference Rules A-D (light yellow, flagged)
//   PRIORITY 5  default catch-all   → Rules 8, 11, 13 (yellow/amber)
//   PRIORITY 6  no match            → UNCLASSIFIED, flag for manual review
//
// Legal refs encoded in reasons:
//   LTVA = Luxembourg VAT Law
//   EU VAT Directive 2006/112/EC

import { isEU, isLuxembourg } from './eu-countries';
import type { TreatmentCode } from './treatment-codes';
import {
  EXEMPTION_KEYWORDS,
  FUND_MGMT_KEYWORDS,
  FUND_MGMT_EXCLUSION_KEYWORDS,
  TAXABLE_PROFESSIONAL_KEYWORDS,
  REAL_ESTATE_KEYWORDS,
  REAL_ESTATE_TAXABLE_CARVEOUTS,
  DOMICILIATION_KEYWORDS,
  OUT_OF_SCOPE_KEYWORDS,
  GOODS_KEYWORDS,
  ART_44_PARA_A_REFS,
  ART_44_PARA_B_REFS,
  ART_44_PARA_D_REFS,
  ART_45_OPT_REFS,
  FRANCHISE_KEYWORDS,
  CONSTRUCTION_KEYWORDS,
  SPECIFIC_RC_KEYWORDS,
  REDUCED_RATE_14_KEYWORDS,
  REDUCED_RATE_08_KEYWORDS,
  REDUCED_RATE_03_KEYWORDS,
  PREPAYMENT_KEYWORDS,
  BAD_DEBT_KEYWORDS,
  PLATFORM_DEEMED_SUPPLIER_KEYWORDS,
  NON_DEDUCTIBLE_KEYWORDS,
  PASSIVE_HOLDING_HIGH_FLAG_KEYWORDS,
  DIRECTOR_FEE_KEYWORDS,
  CARRY_INTEREST_KEYWORDS,
  WATERFALL_DISTRIBUTION_KEYWORDS,
  STRUCTURING_FEE_KEYWORDS,
  IGP_KEYWORDS,
  CREDIT_INTERMEDIATION_KEYWORDS,
  SECURITIZATION_MGMT_KEYWORDS,
  SECURITIZATION_SERVICER_KEYWORDS,
  LEGAL_SUFFIXES,
  containsAny,
  findFirstMatch,
} from './exemption-keywords';

export interface InvoiceLineInput {
  direction: 'incoming' | 'outgoing';
  country: string | null;
  vat_rate: number | null;
  vat_applied: number | null;
  amount_eur: number | null;
  description: string | null;
  // Optional full invoice text (extractor may capture). Falls back to description.
  invoice_text?: string | null;
  // Batch 4 extractor signals — when present, these take precedence over
  // text-based heuristics because they come from the extractor's direct
  // reading of the invoice.
  is_disbursement?: boolean | null;
  is_credit_note?: boolean | null;
  exemption_reference?: string | null;  // explicit Art. 44§1 b / 44§1 d / etc.
  customer_country?: string | null;     // ISO-2 of the invoice recipient (for outgoing)
  customer_vat?: string | null;         // VIES VAT number of the recipient (for outgoing B2B evidence)
  // Supplier identity — used by RULE 32 (director fees) to route natural-
  // person vs legal-person via LEGAL_SUFFIXES token detection. Optional:
  // when absent, the classifier falls back to description-only heuristics.
  supplier_name?: string | null;
  supplier_is_legal_person?: boolean | null;  // extractor-provided, overrides heuristic
}

export interface EntityContext {
  entity_type?: 'fund' | 'active_holding' | 'passive_holding' | 'gp' | 'manco' | 'securitization_vehicle' | 'other' | null;
  // The total value of outgoing OUT_LUX_00 invoices on this declaration.
  // Used by inference rules A/B to compare orders of magnitude.
  exempt_outgoing_total?: number;
  // Whether the entity is a member of a LU VAT group under Art. 60ter
  // LTVA. When set, intra-group incoming invoices route to VAT_GROUP_OUT
  // per RULE 20 (Finanzamt T II C-184/23 — definitively out of scope).
  vat_group_id?: string | null;
  // Whether the entity has filed a valid Art. 45 LTVA opt-in for at
  // least one rental property. Used by RULE 28 to accept 17% on outgoing
  // rent invoices.
  has_art_45_option?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────
// isQualifyingForArt44D
//   Centralises the test of whether the recipient entity qualifies for
//   the Art. 44§1 d LTVA / Art. 135(1)(g) Directive management-of-special-
//   investment-funds exemption.
//
//   Today this returns TRUE for both:
//     - entity_type === 'fund'                  (UCITS, SIF, RAIF, SICAR,
//                                                UCI Part II, qualifying AIF)
//     - entity_type === 'securitization_vehicle' (Loi du 22 mars 2004 as
//                                                amended 2022, per
//                                                Fiscale Eenheid X C-595/13)
//
//   Do NOT include: 'manco' / 'gp' / 'active_holding' / 'passive_holding'
//   (they are not "special investment funds" within the exemption).
//
//   When a future case widens the perimeter (e.g. DB pension funds
//   confirmed qualifying, or a specific SV sub-type carved out), this is
//   the single place to change — every classifier rule uses this helper.
// ─────────────────────────────────────────────────────────────────────────
export function isQualifyingForArt44D(ctx: EntityContext | null | undefined): boolean {
  const t = ctx?.entity_type;
  return t === 'fund' || t === 'securitization_vehicle';
}

export interface PrecedentMatch {
  treatment: TreatmentCode;
  description: string | null;
  last_amount: number | null;
}

export interface ClassificationResult {
  treatment: TreatmentCode | null;
  rule: string;                // e.g. "RULE 11", "INFERENCE A", "PRECEDENT", "OVERRIDE · X", "TIER 4 · AI PROPOSER", "NO_MATCH"
  reason: string;              // human/legal explanation
  source: 'rule' | 'precedent' | 'inference' | 'override' | 'ai_proposer';
  flag: boolean;
  flag_reason?: string;
}

const TOLERANCE = 0.005;
const rateEquals = (a: number | null | undefined, target: number): boolean =>
  a != null && Math.abs(Number(a) - target) < TOLERANCE;
const isZeroOrNull = (v: number | null | undefined): boolean =>
  v == null || Math.abs(Number(v)) < TOLERANCE;

const fullText = (line: InvoiceLineInput): string =>
  [line.description || '', line.invoice_text || ''].join(' ');

// ────────────────────────── Public entry point ──────────────────────────
export function classifyInvoiceLine(
  line: InvoiceLineInput,
  context: EntityContext = {},
  precedent: PrecedentMatch | null = null,
): ClassificationResult {
  // Delegate to the inner classifier, then run a thin post-processor that
  // decorates the result with audit hints (RULE 30 pre-payment Art. 61§1
  // chargeability) without altering the treatment. The reason we don't
  // fold the pre-payment check into each rule branch: it needs to fire
  // on top of whatever normal classification applies (taxable, exempt,
  // reverse-charge — all still correct; only the tax point timing is
  // special).
  const result = classifyInvoiceLineInner(line, context, precedent);
  return decorateWithPrepaymentHint(result, line);
}

function classifyInvoiceLineInner(
  line: InvoiceLineInput,
  context: EntityContext = {},
  precedent: PrecedentMatch | null = null,
): ClassificationResult {

  // PRIORITY 1.3 — content-specific rules that must override every generic
  //                pattern: director fees (C-288/22 TP / Circ. 781-2),
  //                carry interest, waterfall distributions, IGP / cost-
  //                sharing. These trigger on description keywords and
  //                route to OUT_SCOPE or specific taxable treatments
  //                with legal citations. Running them first prevents
  //                the generic rate / exemption rules from mis-
  //                classifying a director fee as RC_EU_TAX, etc.
  const contentSpecific = applyContentSpecificRules(line, context);
  if (contentSpecific) return contentSpecific;

  // PRIORITY 1.5 — passive-holding gate. A pure passive SOPARFI is not a
  // taxable person (Polysar C-60/90 / Cibo C-16/00) and has no RC
  // obligation. This MUST run before direct-evidence / inference /
  // taxable-backstop — otherwise the classifier auto-reverse-charges a
  // service the entity has no right (or obligation) to account for.
  // Extended 2026-04-19 with the LU-domestic leg (RULE 15P): a LU
  // supplier invoicing VAT to a passive holding produces non-deductible
  // input VAT (box 087, not 085) because Polysar blocks the deduction
  // right altogether.
  const country0 = (line.country || '').toUpperCase();
  const isLu0 = isLuxembourg(country0);
  const isEu0 = isEU(country0) && !isLu0;
  if (context.entity_type === 'passive_holding' && line.direction === 'incoming') {
    // Sub-case RULE 15P: LU supplier + VAT charged → non-deductible
    if (isLu0 && !isZeroOrNull(line.vat_applied)) {
      return {
        treatment: 'LUX_17_NONDED',
        rule: 'RULE 15P',
        reason: 'LU input VAT received by a passive holding — not deductible per Polysar (C-60/90). No taxable activity means no deduction right (Art. 49§1 LTVA). VAT lands in box 087, not 085.',
        source: 'rule',
        flag: true,
        flag_reason:
          'This entity is classified as passive_holding. Per Polysar C-60/90 / Cibo C-16/00, a pure holding is not a taxable person and cannot deduct input VAT. '
          + 'If the entity in fact provides active management / admin / financial services to subsidiaries (Cibo, Marle C-320/17), change entity_type to "active_holding" '
          + 'to unlock pro-rata deduction.',
      };
    }

    // Sub-case RULES 11P / 13P: cross-border, no VAT charged → flag-only
    if (!isLu0 && country0 !== '' && isZeroOrNull(line.vat_applied)) {
      const text0 = fullText(line);
      const isHighRisk = containsAny(text0, PASSIVE_HOLDING_HIGH_FLAG_KEYWORDS);
      return {
        treatment: null,
        rule: isEu0 ? 'RULE 11P' : 'RULE 13P',
        reason: 'Passive holding receiving a cross-border service — not a taxable person under Polysar (C-60/90) / Cibo Participations (C-16/00).',
        source: 'rule',
        flag: true,
        flag_reason:
          (isHighRisk
            ? 'High-risk service type (legal / tax / M&A / due diligence advisory) received by a PASSIVE holding. '
            : 'Cross-border service received by a PASSIVE holding. ')
          + 'The supplier should have charged origin-country VAT; there is no LU reverse-charge obligation. '
          + 'If the entity is in fact an ACTIVE holding (provides management / admin services to subsidiaries), '
          + 'change entity_type to "active_holding" and re-run classification (Marle Participations C-320/17).',
      };
    }
  }

  // PRIORITY 2 — direct evidence rules (always take precedence over precedent
  //              and inference, because the invoice itself states the facts).
  const direct = applyDirectEvidenceRules(line, context);
  if (direct) return direct;

  // PRIORITY 2.5 — INFERENCE E taxable backstop. When a clearly-taxable
  // professional-services keyword is present (legal, tax, audit, M&A),
  // do NOT let the INFERENCE A/B/C/D rules auto-exempt. These services
  // are taxable regardless of entity type, so they reverse-charge at the
  // standard rate.
  if (line.direction === 'incoming') {
    const taxableBackstop = applyTaxableBackstop(line);
    if (taxableBackstop) return taxableBackstop;
  }

  // PRIORITY 3 — precedent match from prior year
  if (precedent) {
    return {
      treatment: precedent.treatment,
      rule: 'PRECEDENT',
      reason: `Matches prior-year treatment for this provider (${precedent.treatment}).`,
      source: 'precedent',
      flag: false,
    };
  }

  // PRIORITY 4 — contextual inference rules
  const inference = applyInferenceRules(line, context);
  if (inference) return inference;

  // PRIORITY 5 — default catch-all
  const fallback = applyFallbackRules(line, context);
  if (fallback) return fallback;

  // PRIORITY 6 — no match
  return {
    treatment: null,
    rule: 'NO_MATCH',
    reason: 'No classification rule matched.',
    source: 'rule',
    flag: true,
    flag_reason: 'No classification rule matched — manual review required.',
  };
}

// ────────────────────────── Post-processors ──────────────────────────
//
// Decorators applied AFTER the main rule pipeline returns. They don't
// change the classification decision — they enrich the audit trail
// (flag + reason) with cross-cutting observations the per-rule branches
// would have had to duplicate.
//
// Today: pre-payment chargeability (RULE 30 / Art. 61§1 LTVA).
// Future candidates: bad-debt relief regularisation, credit-note
// context when the original invoice period is closed.
//

/** RULE 30 post-processor — adds tax-point timing warning when the line
 *  references a pre-payment / advance / deposit / acompte.
 *
 *  Art. 61§1 LTVA (transposing Art. 65 Directive): for pre-payments,
 *  VAT chargeability arises at the date of receipt of payment, BEFORE
 *  the goods / services are rendered. This means a pre-payment invoice
 *  can land in a declaration period that doesn't match the actual
 *  performance period — reviewers need to verify the tax point vs. the
 *  return's start/end dates. The normal classification (taxable / exempt
 *  / reverse-charge) is correct; only the timing is special.
 *
 *  We force flag=true and append to flag_reason; we never change the
 *  treatment or the rule name. The line keeps its original RULE X
 *  attribution with a "+ RULE 30 pre-payment note" suffix so the audit
 *  trail shows both rationales. */
function decorateWithPrepaymentHint(
  result: ClassificationResult,
  line: InvoiceLineInput,
): ClassificationResult {
  const text = fullText(line);
  if (!containsAny(text, PREPAYMENT_KEYWORDS)) return result;
  // Don't decorate NO_MATCH lines — they're already flagged; adding a
  // second hint muddies the primary "no rule fired" signal. Reviewer
  // will see PREPAYMENT_KEYWORDS in the description anyway.
  if (result.rule === 'NO_MATCH') return result;
  const matched = findFirstMatch(text, PREPAYMENT_KEYWORDS) ?? 'pre-payment';
  const prepaymentNote =
    `Pre-payment reference detected ("${matched}") — Art. 61§1 LTVA (Art. 65 Directive) makes VAT chargeable at the DATE OF PAYMENT, `
    + `not the performance date. Verify the tax point aligns with the declaration period: a pre-payment received near a period boundary `
    + `can legitimately fall in a different return than the underlying service. When the final invoice is issued, treat it as a balance `
    + `(only the delta not yet pre-paid bears new VAT).`;
  const combinedReason = result.flag_reason
    ? `${result.flag_reason}\n\n${prepaymentNote}`
    : prepaymentNote;
  return {
    ...result,
    flag: true,
    flag_reason: combinedReason,
    rule: result.rule.includes('+ RULE 30') ? result.rule : `${result.rule} + RULE 30`,
  };
}

// ────────────────────────── Priority 2: direct evidence ──────────────────────────
//
// Ordering inside this function matters. Higher-priority signals (explicit
// extractor flags, explicit legal citations) beat text-sweep heuristics.
// Every rule that fires on text alone carries a flag so the reviewer can
// override.
function applyDirectEvidenceRules(
  line: InvoiceLineInput,
  ctx: EntityContext = {},
): ClassificationResult | null {
  const country = (line.country || '').toUpperCase();
  const customerCountry = (line.customer_country || '').toUpperCase();
  const customerVat = (line.customer_vat || '').trim();
  const desc = line.description || '';
  const text = fullText(line);
  const exRef = line.exemption_reference || '';
  const isLu = isLuxembourg(country);
  const isEu = isEU(country) && !isLu;
  const entityType = ctx.entity_type;
  // Qualifies for Art. 44§1 d LTVA fund-management exemption — covers
  // both entity_type='fund' and 'securitization_vehicle' per Fiscale
  // Eenheid X C-595/13 extension.
  const isFundEntity = isQualifyingForArt44D(ctx);
  const isSvEntity = entityType === 'securitization_vehicle';

  // ═══════════════ RULE 16 — Extractor-flagged disbursement ═══════════════
  // Art. 28§3 c LTVA débours have four evidentiary conditions (expense
  // incurred in the name of the customer, booked in a suspense account,
  // no margin, supported by the original third-party invoice). The
  // extractor's single boolean is a starting signal; we classify as
  // DEBOURS but always flag so the reviewer confirms Art. 70 defensibility.
  if (line.is_disbursement === true) {
    return {
      treatment: 'DEBOURS',
      rule: 'RULE 16',
      reason: 'Pure pass-through disbursement (débours) at cost — Art. 28§3 c LTVA (outside the VAT scope).',
      source: 'rule',
      flag: true,
      flag_reason:
        'Extractor flagged this line as a disbursement. Art. 28§3 c LTVA requires four evidentiary conditions: '
        + '(a) expense incurred in the name and for the account of the customer, (b) booked in a suspense account, '
        + '(c) no margin (pure pass-through), (d) the original third-party invoice is transferred to the customer. '
        + 'Confirm all four before filing.',
    };
  }

  // ═══════════════ RULE 20 — VAT group (Art. 60ter LTVA) ═══════════════
  // When the entity is a member of a LU VAT group AND the supplier shares
  // the same vat_group_id, the supply is out of scope per CJEU
  // Finanzamt T II (C-184/23, 2024-07-11). Currently the platform does
  // not carry a supplier-registry vat_group_id lookup — the rule flags
  // for manual routing when the reviewer indicates intra-group supply.
  // The treatment code is VAT_GROUP_OUT; the rule emits flag=true so the
  // reviewer confirms the supplier is actually in the same group.
  if (ctx.vat_group_id && line.direction === 'incoming' && isLu
      && isZeroOrNull(line.vat_rate)) {
    return {
      treatment: 'VAT_GROUP_OUT',
      rule: 'RULE 20',
      reason: 'Intra-group supply within the LU VAT group (Art. 60ter LTVA) — out of scope per CJEU Finanzamt T II (C-184/23).',
      source: 'rule',
      flag: true,
      flag_reason:
        `Entity is a member of VAT group ${ctx.vat_group_id}. Confirm the supplier is ALSO a member of the same group before filing. `
        + 'Cross-border supplies to/from a branch outside the LU group are taxable per Skandia (C-7/13) and Danske Bank (C-812/19).',
    };
  }

  // ═══════════════ RULE 22 — Platform deemed supplier ═══════════════
  // Invoice from a digital platform covered by Art. 9a Reg. 282/2011 /
  // ViDA 2027 extension. Classifies as PLATFORM_DEEMED with a flag so
  // the reviewer checks whether the platform is truly the VAT-relevant
  // supplier.
  // Authority: CJEU Fenix International C-695/20 (validity of Art. 9a).
  // NOTE: Versãofast T-657/24 was previously cited here in error —
  // Versãofast is a CREDIT INTERMEDIATION case (Art. 135(1)(b)), not
  // platform-economy. Credit intermediation lives in RULE 36.
  if (containsAny(text, PLATFORM_DEEMED_SUPPLIER_KEYWORDS)) {
    return {
      treatment: 'PLATFORM_DEEMED',
      rule: 'RULE 22',
      reason: 'Digital platform deemed the supplier under Art. 9a Reg. 282/2011 (Fenix International C-695/20).',
      source: 'rule',
      flag: true,
      flag_reason:
        'Invoice mentions a platform / deemed-supplier phrase. Confirm the platform genuinely intermediates on its own account — pass-through fee invoices do not apply Art. 9a.',
    };
  }

  // ═══════════════ RULE 24 — Margin-scheme invoice (Art. 56bis LTVA) ═══
  // Buyer CANNOT deduct input VAT on a margin-scheme invoice.
  if (line.direction === 'incoming'
      && (containsAny(text, ['régime de la marge', 'margin scheme', 'régime particulier — agences de voyages',
          'sonderregelung für reisebüros', 'art. 56bis', 'article 56bis', 'art. 311 directive']))) {
    return {
      treatment: 'MARGIN_NONDED',
      rule: 'RULE 24',
      reason: 'Margin-scheme invoice (Art. 56bis LTVA / Art. 311-325 Directive) — buyer has no input-VAT deduction right.',
      source: 'rule',
      flag: true,
      flag_reason:
        'Margin-scheme invoices show a single gross amount without separated VAT. Do NOT attempt to deduct any implicit VAT — it is non-recoverable.',
    };
  }

  // ═══════════════ RULE 25 — Domestic RC on construction works ═══════════
  // LU-to-LU supply of construction / renovation / demolition / cleaning
  // works to a taxable person, reverse-charged per Art. 61§2 c LTVA.
  if (line.direction === 'incoming' && isLu && isZeroOrNull(line.vat_applied)
      && containsAny(text, CONSTRUCTION_KEYWORDS)) {
    return {
      treatment: 'RC_LUX_CONSTR_17',
      rule: 'RULE 25',
      reason: 'Domestic reverse-charge on construction works — Art. 61§2 c LTVA (transposing Art. 199 Directive).',
      source: 'rule',
      flag: true,
      flag_reason:
        'LU construction-work invoice with no VAT. Art. 61§2 c requires the recipient (taxable person) to self-assess VAT. '
        + 'Confirm the supplier is a registered construction contractor and the work falls within the RGD 21 décembre 1991 list.',
    };
  }

  // ═══════════════ RULE 26 — Domestic RC on scrap / emission / electricity wholesale ═══
  if (line.direction === 'incoming' && isLu && isZeroOrNull(line.vat_applied)
      && containsAny(text, SPECIFIC_RC_KEYWORDS)) {
    return ruleMatch('RULE 26', 'RC_LUX_SPEC_17',
      'Domestic reverse-charge on scrap / emission allowances / electricity wholesale — Art. 61§2 a-b LTVA (Art. 199a Directive quick-reaction mechanism).');
  }

  // ═══════════════ RULE 27 — Bad-debt relief (Art. 62 LTVA) ═══════════════
  // Credit-note or regularisation invoice with bad-debt wording.
  if (containsAny(text, BAD_DEBT_KEYWORDS)) {
    return {
      treatment: 'BAD_DEBT_RELIEF',
      rule: 'RULE 27',
      reason: 'Bad-debt regularisation — Art. 62 LTVA (CJEU Enzo Di Maura C-246/16).',
      source: 'rule',
      flag: true,
      flag_reason:
        'Bad-debt relief requires evidence the receivable is definitively uncollectible (court judgment / bankruptcy filing). '
        + 'Enter the clawback amount as a positive rc_amount (convention: always positive = amount reclaimed from Treasury).',
    };
  }

  // ═══════════════ RULE 29 — Non-deductible LU input VAT (Art. 54 LTVA) ═══
  // LU 17% invoice that falls in a non-deductible category must land on
  // LUX_17_NONDED (box 087), not on the deductible tier (box 085).
  if (line.direction === 'incoming' && isLu && rateEquals(line.vat_rate, 0.17)
      && containsAny(text, NON_DEDUCTIBLE_KEYWORDS)) {
    const matched = findFirstMatch(text, NON_DEDUCTIBLE_KEYWORDS);
    return {
      treatment: 'LUX_17_NONDED',
      rule: 'RULE 29',
      reason: `LU VAT 17% on a non-deductible category ("${matched}") — Art. 54 LTVA restriction; VAT lands in box 087, not 085.`,
      source: 'rule',
      flag: true,
      flag_reason:
        'Input VAT on entertainment / accommodation / passenger cars / tobacco / gifts is fully or partly non-deductible under '
        + 'Art. 54 LTVA. Confirm the full non-deductibility vs. partial apportionment (Art. 55 mixed-use).',
    };
  }

  // ═══════════════ RULE 30 — Pre-payment / advance (Art. 61§1 LTVA) ═══════
  // Pre-payments trigger chargeability at the PAYMENT date, before the
  // service is rendered (Art. 61§1 LTVA / Art. 65 Directive). Classification
  // (taxable / exempt / reverse-charge) is unchanged — only the tax point
  // timing differs, which may straddle declaration periods. Actual flagging
  // happens in decorateWithPrepaymentHint at the top-level of
  // classifyInvoiceLine — the post-processor inspects PREPAYMENT_KEYWORDS
  // in the combined text and adds flag + reason guidance to whatever rule
  // fires. The explicit no-op here is retained so the rule is documented
  // at the numeric ordering location where a future refactor would expect
  // it. See decorateWithPrepaymentHint below.

  // ═══════════════ RULE 31 — Autolivraison (Art. 12 LTVA) ═══════════════
  // Extractor flagged the document as a self-supply.
  if (line.is_credit_note !== true && (line as InvoiceLineInput & { self_supply_mentioned?: boolean }).self_supply_mentioned === true
      && line.direction === 'outgoing') {
    return {
      treatment: 'AUTOLIV_17',
      rule: 'RULE 31',
      reason: 'Self-supply / autolivraison under Art. 12 LTVA — declared as output VAT 17% and matching deductible input VAT.',
      source: 'rule',
      flag: true,
      flag_reason:
        'Autolivraison requires both an output VAT entry (box 044/045) and a corresponding deductible input VAT entry. '
        + 'Confirm the self-supply base value and applicable rate (most commonly 17%).',
    };
  }

  // ═══════════════ Consume extractor-captured Art. 44 reference ═══════════════
  // When the extractor captured an explicit paragraph reference, it beats
  // every text-sweep. We use the reference to pick the sub-paragraph so
  // Annexe B is categorised correctly.
  if (exRef) {
    if (line.direction === 'incoming') {
      if (containsAny(exRef, ART_44_PARA_A_REFS)) {
        return ruleMatch('RULE 7A', 'EXEMPT_44A_FIN',
          `Exempt under Art. 44§1 a LTVA (financial services) — extractor-captured reference "${exRef}".`);
      }
      if (containsAny(exRef, ART_44_PARA_B_REFS)) {
        return ruleMatch('RULE 7B', 'EXEMPT_44B_RE',
          `Exempt under Art. 44§1 b LTVA (real-estate letting) — extractor-captured reference "${exRef}".`);
      }
      if (containsAny(exRef, ART_44_PARA_D_REFS)) {
        return ruleMatch('RULE 7D', 'EXEMPT_44',
          `Exempt under Art. 44§1 d LTVA (fund management) — extractor-captured reference "${exRef}". Verify the recipient is a qualifying special investment fund (BlackRock C-231/19).`);
      }
    }
    if (line.direction === 'outgoing' && containsAny(exRef, ART_45_OPT_REFS)) {
      if (rateEquals(line.vat_rate, 0.17)) {
        return ruleMatch('RULE 15A', 'OUT_LUX_17_OPT',
          `Outgoing real-estate letting taxed by option under Art. 45 LTVA — extractor-captured reference "${exRef}".`);
      }
    }
  }

  if (line.direction === 'incoming') {
    // LU + explicit rate
    if (isLu && rateEquals(line.vat_rate, 0.17)) return ruleMatch('RULE 1', 'LUX_17', 'Luxembourg standard rate 17% (Art. 40 LTVA).');
    if (isLu && rateEquals(line.vat_rate, 0.14)) return ruleMatch('RULE 2', 'LUX_14', 'Luxembourg reduced rate 14% (Art. 40-1 LTVA).');
    if (isLu && rateEquals(line.vat_rate, 0.08)) return ruleMatch('RULE 3', 'LUX_08', 'Luxembourg reduced rate 8% (Art. 40-1 LTVA).');
    if (isLu && rateEquals(line.vat_rate, 0.03)) return ruleMatch('RULE 4', 'LUX_03', 'Luxembourg super-reduced rate 3% (Art. 40-1 LTVA).');

    // LU + no VAT + direct keywords
    if (isLu && isZeroOrNull(line.vat_rate)) {
      // Domiciliation — ALWAYS taxable at 17% under Circ. 764. This block
      // must run BEFORE any real-estate check because the old behaviour
      // of classifying "domiciliation" as LUX_00 was the most frequent
      // misclassification for SOPARFIs.
      if (containsAny(desc, DOMICILIATION_KEYWORDS)) {
        return {
          treatment: 'LUX_17',
          rule: 'RULE 5D',
          reason: 'Domiciliation / corporate services — taxable at 17% per AED Circ. 764 (Art. 28-5 LTVA). Not a real-estate letting.',
          source: 'rule',
          flag: true,
          flag_reason:
            'Domiciliation invoice with no VAT shown. AED Circ. 764 requires 17% on this service. '
            + 'Either the supplier forgot the VAT (ask for a corrected invoice) or this is not in fact '
            + 'a domiciliation. Do NOT treat as real-estate letting under Art. 44§1 b.',
        };
      }
      if (containsAny(desc, REAL_ESTATE_KEYWORDS)) {
        // Carve-out check: hotels, parking, hunting, machinery rental are
        // taxable per Art. 44§1 b points 1-4.
        const carveOut = findFirstMatch(desc, REAL_ESTATE_TAXABLE_CARVEOUTS);
        if (carveOut) {
          return {
            treatment: 'LUX_17', rule: 'RULE 5C',
            reason: `Real-estate supply (${carveOut}) — carve-out from Art. 44§1 b exemption; taxable at 17%. Verify rate on the invoice.`,
            source: 'rule', flag: true,
            flag_reason: `"${carveOut}" is one of the Art. 44§1 b points 1-4 carve-outs and is always taxable.`,
          };
        }
        return {
          treatment: 'LUX_00', rule: 'RULE 5',
          reason: 'Exempt letting of immovable property (Art. 44§1 b LTVA).',
          source: 'rule', flag: true,
          flag_reason:
            'Real-estate keyword matched. Confirm: (i) the landlord has NOT opted for taxation '
            + 'under Art. 45 (in which case VAT should be 17%); (ii) the property is not within '
            + 'the carve-outs (hotel, parking, hunting, safe-deposit, machinery rental).',
        };
      }
      if (containsAny(desc, OUT_OF_SCOPE_KEYWORDS)) {
        const matched = findFirstMatch(desc, OUT_OF_SCOPE_KEYWORDS);
        return ruleMatch('RULE 6', 'OUT_SCOPE',
          `Out of scope — "${matched ?? 'unrecognised'}" is outside the VAT scope (LTVA Art. 4§5 public-authority levy / Art. 2 no-consideration).`);
      }
      if (containsAny(text, FRANCHISE_KEYWORDS)) {
        return ruleMatch('RULE 23', 'LUX_00',
          'LU supplier under Art. 57 LTVA franchise threshold — no VAT charged and no deduction available to the recipient.');
      }
      if (containsAny(text, EXEMPTION_KEYWORDS)) {
        // Pick Art. 44 sub-paragraph from the matched keyword family.
        if (containsAny(text, FUND_MGMT_KEYWORDS)) {
          return ruleMatch('RULE 7', 'EXEMPT_44',
            'Exempt under Art. 44§1 d LTVA (fund management) — transposing Art. 135(1)(g) EU VAT Directive.');
        }
        return {
          treatment: 'EXEMPT_44', rule: 'RULE 7',
          reason: 'Exempt supply with an Art. 44 reference — specific sub-paragraph not determined.',
          source: 'rule', flag: true,
          flag_reason: 'Exemption keyword matched but sub-paragraph (44§1 a/b/c/d/e) could not be inferred. Select the correct code manually.',
        };
      }
      // RULE 8 is default catch-all — handled in applyFallbackRules
    }

    // ═══════════════ RULE 17 — IC acquisition of goods, by rate ═══════════════
    // Correct IC pattern: zero VAT on the supplier invoice (exempt IC supply
    // at origin per Art. 138 Directive). We classify at the applicable LU
    // rate. When the supplier erroneously charged foreign VAT, flag as
    // anomaly instead of silently reverse-charging at the foreign rate.
    if (isEu && containsAny(desc, GOODS_KEYWORDS)) {
      if (!isZeroOrNull(line.vat_applied)) {
        return {
          treatment: null, rule: 'RULE 17X',
          reason: 'EU supplier charged foreign VAT on a goods supply — anomaly.',
          source: 'rule', flag: true,
          flag_reason:
            'Intra-Community supplies of goods are normally exempt at origin (Art. 138 Directive) '
            + 'and the acquirer reverse-charges at the LU rate. This invoice shows supplier VAT — '
            + 'request a corrected invoice and seek refund in the origin Member State.',
        };
      }
      if (rateEquals(line.vat_rate, 0.17)) return ruleMatch('RULE 17', 'IC_ACQ_17', 'Intra-Community acquisition of goods, applicable LU rate 17% — Art. 21 LTVA.');
      if (rateEquals(line.vat_rate, 0.14)) return ruleMatch('RULE 17', 'IC_ACQ_14', 'Intra-Community acquisition of goods, applicable LU rate 14% — Art. 21 LTVA.');
      if (rateEquals(line.vat_rate, 0.08)) return ruleMatch('RULE 17', 'IC_ACQ_08', 'Intra-Community acquisition of goods, applicable LU rate 8% — Art. 21 LTVA.');
      if (rateEquals(line.vat_rate, 0.03)) return ruleMatch('RULE 17', 'IC_ACQ_03', 'Intra-Community acquisition of goods, applicable LU rate 3% — Art. 21 LTVA.');
      // No rate readable — fall back to the legacy generic code (RULE 9), flag.
      return {
        treatment: 'IC_ACQ', rule: 'RULE 9',
        reason: 'Intra-Community acquisition of goods (Art. 21 LTVA) — applicable LU rate not determined.',
        source: 'rule', flag: true,
        flag_reason: 'Applicable LU rate could not be inferred. Select IC_ACQ_17 / 14 / 08 / 03 manually before filing — box 051 = Σ(711..717) must reconcile.',
      };
    }

    // ═══════════════ RULE 11X — foreign VAT on a service (anomaly) ═══════════════
    // Service mirror of RULE 17X. When an EU or non-EU supplier's invoice for a
    // B2B service shows non-zero VAT, flag as anomaly. The correct pattern under
    // Art. 44 Directive (place of supply = recipient) + Art. 196 (recipient
    // reverse-charges) is: supplier issues no VAT, LU acquirer self-assesses at
    // the LU rate. Foreign VAT on the invoice is NOT deductible in Luxembourg
    // (C-333/20 Wilo Salmson, Art. 49 LTVA). We deliberately do NOT auto-classify
    // as RC_EU_TAX / RC_NONEU_TAX — the amount line would be wrong (includes
    // foreign VAT) and reviewing the supplier relationship is the right action.
    //
    // Must fire AFTER the RULE 17 goods block above so goods wins by position,
    // and BEFORE RULE 10 (which needs zero VAT and so cannot intersect).
    if ((isEu || (!isLu && !isEu && country !== ''))
        && !containsAny(desc, GOODS_KEYWORDS)
        && !isZeroOrNull(line.vat_applied)) {
      const originBlock = isEu ? 'EU' : 'non-EU';
      return {
        treatment: null, rule: 'RULE 11X',
        reason: `${originBlock} supplier charged foreign VAT on a service — anomaly.`,
        source: 'rule', flag: true,
        flag_reason:
          'B2B services to a Luxembourg taxable person should be reverse-charged at the '
          + 'LU rate (Art. 44 / 196 Directive; Art. 17§1 LTVA). The supplier must issue no VAT; '
          + 'foreign VAT appearing on the invoice is NOT deductible in Luxembourg (C-333/20 '
          + 'Wilo Salmson, Art. 49 LTVA). Action: request a corrected invoice (removing the '
          + 'foreign VAT) and reclaim the VAT already paid from the origin Member State. If '
          + 'recovery is impossible, absorb as non-deductible cost — classify as LUX_00 manually.',
      };
    }

    // ═══════════════ RULE 10 — RC EU exempt (fund management) ═══════════════
    // Gated on entity_type === 'fund'. Per CJEU BlackRock (C-231/19) and
    // Fiscale Eenheid X (C-595/13), the Art. 44§1 d exemption applies only
    // when the recipient is a qualifying special investment fund. A
    // SOPARFI / active-holding / GP receiving management fees must
    // reverse-charge at 17% (RC_EU_TAX), not RC_EU_EX. The earlier rule
    // auto-exempted without entity-type guard — CRITICAL AED exposure.
    if (isEu && isZeroOrNull(line.vat_applied)
        && containsAny(text, FUND_MGMT_KEYWORDS)
        && containsAny(text, EXEMPTION_KEYWORDS)) {
      if (isFundEntity) {
        const reason = isSvEntity
          ? 'Reverse charge, exempt under Art. 44§1 d LTVA — management of a Luxembourg securitisation vehicle (Fiscale Eenheid X C-595/13; Loi du 22 mars 2004 modifiée 2022) — eCDF box 435.'
          : 'Reverse charge, exempt under Art. 44§1 d LTVA (fund management to a qualifying special investment fund) — eCDF box 435.';
        return ruleMatch('RULE 10', 'RC_EU_EX', reason);
      }
      // Non-fund entity — do NOT auto-exempt.
      return {
        treatment: 'RC_EU_TAX', rule: 'RULE 10X',
        reason: 'EU fund-management-style invoice received by a non-fund entity — reverse-charge at 17% (Art. 17§1 LTVA).',
        source: 'rule', flag: true,
        flag_reason:
          'Invoice cites Art. 44 but the recipient is not classified as a qualifying special investment fund '
          + '(per BlackRock C-231/19 / Fiscale Eenheid X C-595/13). Treated as taxable reverse-charge. '
          + 'If the entity IS a qualifying fund (UCITS, SIF, RAIF, SICAR, Part II UCI) or a Luxembourg '
          + 'securitisation vehicle (Loi 2004/2022), change entity_type to fund / securitization_vehicle and re-run.',
      };
    }

    // ═══════════════ RULE 19 — Import VAT from non-EU goods (FLAG-ONLY) ═══════════════
    // Previous behaviour auto-classified the line as IMPORT_VAT and
    // promised deduction in box 077. That was fiscally WRONG — the VAT on
    // a foreign supplier's commercial invoice is foreign VAT, not LU
    // import VAT. LU import VAT arises from the customs declaration (DAU)
    // and is only deductible against that document. Auto-deducting the
    // commercial VAT overstates deductions and is exactly what triggers
    // Art. 70 LTVA penalties. We now FLAG without classifying.
    if (!isLu && !isEu && country !== ''
        && containsAny(desc, GOODS_KEYWORDS)
        && !isZeroOrNull(line.vat_applied)) {
      return {
        treatment: null, rule: 'RULE 19',
        reason: 'Non-EU goods supplier invoice with VAT-like amount — requires manual routing.',
        source: 'rule', flag: true,
        flag_reason:
          'VAT on a non-EU supplier invoice is FOREIGN VAT and is NOT deductible in Luxembourg. '
          + 'LU import VAT arises from the customs declaration (DAU / bordereau des douanes), not '
          + 'the commercial invoice. Route options: (a) if you hold the DAU, classify as IMPORT_VAT '
          + 'manually and book the customs VAT (not the commercial one) in box 077; (b) otherwise, '
          + 'the commercial-invoice VAT is unrecoverable foreign VAT — classify as LUX_00 and absorb.',
      };
    }

    // ═══════════════ RULE 12 — RC non-EU exempt (fund management) ═══════════════
    // Same entity-type guard as RULE 10.
    if (!isLu && !isEu && country !== ''
        && isZeroOrNull(line.vat_applied)
        && containsAny(text, FUND_MGMT_KEYWORDS)
        && containsAny(text, EXEMPTION_KEYWORDS)) {
      if (isFundEntity) {
        const reason = isSvEntity
          ? 'Reverse charge, exempt under Art. 44§1 d LTVA — management of a Luxembourg securitisation vehicle (Fiscale Eenheid X C-595/13; non-EU supplier) — eCDF box 445.'
          : 'Reverse charge, exempt under Art. 44§1 d LTVA (fund management to a qualifying special investment fund, non-EU supplier) — eCDF box 445.';
        return ruleMatch('RULE 12', 'RC_NONEU_EX', reason);
      }
      return {
        treatment: 'RC_NONEU_TAX', rule: 'RULE 12X',
        reason: 'Non-EU fund-management-style invoice received by a non-fund entity — reverse-charge at 17% (Art. 17§1 LTVA).',
        source: 'rule', flag: true,
        flag_reason:
          'Invoice cites Art. 44 but the recipient is not classified as a qualifying special investment fund. '
          + 'Treated as taxable reverse-charge. Change entity_type to fund / securitization_vehicle and re-run if applicable.',
      };
    }
  }

  if (line.direction === 'outgoing') {
    // ═══════════════ RULE 18 — Outgoing to non-EU customer ═══════════════
    // When the extractor captured customer_country and it is non-EU, the
    // supply is outside the LU VAT scope (place-of-supply rules). Requires
    // zero LU VAT actually charged AND evidence that the customer is a
    // taxable person (B2B) — either a captured VAT number or explicit
    // business-status evidence. Absent that evidence, flag: a B2C supply
    // to a non-EU individual can still be LU-taxable under Art. 17§2
    // LTVA / Art. 45 Directive.
    const isBilledWithoutVat =
      isZeroOrNull(line.vat_rate) && isZeroOrNull(line.vat_applied);
    if (isBilledWithoutVat && customerCountry &&
        !isLuxembourg(customerCountry) && !isEU(customerCountry)) {
      if (customerVat) {
        return ruleMatch('RULE 18', 'OUT_NONEU',
          `Supply to a non-EU business customer (VAT-ID ${customerVat}, ${customerCountry}) — outside the scope of LU VAT (place-of-supply: customer's country).`);
      }
      return {
        treatment: null, rule: 'RULE 18X',
        reason: 'Outgoing to non-EU customer without business-status evidence.',
        source: 'rule', flag: true,
        flag_reason:
          'Customer country is non-EU but no VAT-ID was captured. If the customer is a non-business '
          + '(B2C), the place of supply defaults to Luxembourg (Art. 17§2 LTVA / Art. 45 Directive) '
          + 'and 17% LU VAT applies. Capture the customer\'s tax-status evidence (VAT number or '
          + 'equivalent per Regulation 282/2011 Art. 18) before classifying.',
      };
    }

    // RULE 14 requires BOTH an exemption reference AND zero VAT, AND picks
    // the sub-paragraph based on the matched keyword family (real-estate
    // → 44§1 b, fund management → 44§1 d, financial → 44§1 a).
    if (isBilledWithoutVat && containsAny(text, EXEMPTION_KEYWORDS)) {
      let reason = 'Exempt outgoing supply with explicit legal reference (Art. 44 LTVA) and no VAT charged — eCDF box 012.';
      if (containsAny(text, FUND_MGMT_KEYWORDS)) {
        reason = 'Exempt outgoing supply under Art. 44§1 d LTVA (fund management to a qualifying fund) — eCDF box 012.';
      } else if (containsAny(text, REAL_ESTATE_KEYWORDS)) {
        reason = 'Exempt outgoing supply under Art. 44§1 b LTVA (real-estate letting without Art. 45 opt-in) — eCDF box 012.';
      }
      return ruleMatch('RULE 14', 'OUT_LUX_00', reason);
    }
    if (rateEquals(line.vat_rate, 0.17)) {
      return ruleMatch('RULE 15', 'OUT_LUX_17', 'Taxable outgoing supply at 17% — eCDF boxes 701/046.');
    }
    if (rateEquals(line.vat_rate, 0.14)) return ruleMatch('RULE 15B', 'OUT_LUX_14', 'Taxable outgoing supply at 14% (Art. 40-1 LTVA).');
    if (rateEquals(line.vat_rate, 0.08)) return ruleMatch('RULE 15C', 'OUT_LUX_08', 'Taxable outgoing supply at 8% (Art. 40-1 LTVA).');
    if (rateEquals(line.vat_rate, 0.03)) return ruleMatch('RULE 15D', 'OUT_LUX_03', 'Taxable outgoing supply at 3% (Art. 40-1 LTVA).');
  }

  return null;
}

// ────────────────────────── Priority 2.5: taxable backstop ──────────────────────────
// When the service description matches a clearly-taxable professional
// category (legal, tax, audit, M&A, generic consulting), do NOT let the
// inference chain promote the line into an Art. 44 exemption. These
// services are taxable regardless of the recipient's entity type.
// Only applies to incoming services with no VAT applied — taxable
// invoices with VAT are handled by the direct-evidence rate rules.
function applyTaxableBackstop(line: InvoiceLineInput): ClassificationResult | null {
  if (!isZeroOrNull(line.vat_applied)) return null;
  const text = fullText(line);
  const matched = findFirstMatch(text, TAXABLE_PROFESSIONAL_KEYWORDS);
  if (!matched) return null;
  const country = (line.country || '').toUpperCase();
  const isLu = isLuxembourg(country);
  const isEu = isEU(country) && !isLu;
  if (isLu || !country) return null; // LU handled by direct rate rules / RULE 8

  const treatment: TreatmentCode = isEu ? 'RC_EU_TAX' : 'RC_NONEU_TAX';
  return {
    treatment,
    rule: 'INFERENCE E',
    reason: `"${matched}" — taxable professional service, reverse-charge at 17% (Art. 17§1 LTVA). Art. 44 exemptions are narrow (Deutsche Bank C-44/11, BlackRock C-231/19) and do not cover legal / tax / audit / M&A services.`,
    source: 'inference',
    flag: true,
    flag_reason:
      `Detected taxable-backstop keyword "${matched}". This service is classified as taxable reverse-charge to prevent keyword collisions with Art. 44 fund-management exemption phrases. If the service is in fact within the exemption (rare for ${matched}), override manually.`,
  };
}

// ────────────────────────── Priority 4: contextual inference ──────────────────────────
function applyInferenceRules(line: InvoiceLineInput, ctx: EntityContext): ClassificationResult | null {
  const country = (line.country || '').toUpperCase();
  const desc = line.description || '';
  const text = fullText(line);
  const isLu = isLuxembourg(country);
  const isEu = isEU(country) && !isLu;
  const hasExemptMgmtOutgoing = (ctx.exempt_outgoing_total ?? 0) > 0;

  // Advisory-style service descriptions (subset of FUND_MGMT_KEYWORDS)
  const ADVISORY_KEYWORDS = [
    'investment advisory', 'advisory fee', 'sub-advisory', 'sub advisory',
    'portfolio management', 'gestion de portefeuille', 'conseil en investissement',
    'anlageberatung', 'asesoramiento de inversiones', 'consulenza sugli investimenti',
  ];

  if (line.direction !== 'incoming') return null;
  if (!isZeroOrNull(line.vat_applied)) return null;

  // ─── INFERENCE A: EU advisory matching entity's outgoing exempt pattern ───
  if (isEu && hasExemptMgmtOutgoing && containsAny(desc, ADVISORY_KEYWORDS)) {
    const sameOrderOfMagnitude = sameMagnitude(line.amount_eur, ctx.exempt_outgoing_total);
    if (sameOrderOfMagnitude) {
      return {
        treatment: 'RC_EU_EX',
        rule: 'INFERENCE A',
        reason: 'Inferred as exempt by analogy with the entity\'s own outgoing exempt management fees.',
        source: 'inference',
        flag: true,
        flag_reason:
          'This entity issues exempt management fees (Art. 44) to its fund. This incoming advisory fee ' +
          'appears to be delegated fund management of similar nature and scale. Proposed as exempt. ' +
          'Confirm or change to RC_EU_TAX if this is general consulting.',
      };
    }
  }

  // ─── INFERENCE B: non-EU advisory matching entity's outgoing exempt pattern ───
  if (!isLu && !isEu && country !== '' && hasExemptMgmtOutgoing && containsAny(desc, ADVISORY_KEYWORDS)) {
    const sameOrderOfMagnitude = sameMagnitude(line.amount_eur, ctx.exempt_outgoing_total);
    if (sameOrderOfMagnitude) {
      return {
        treatment: 'RC_NONEU_EX',
        rule: 'INFERENCE B',
        reason: 'Inferred as exempt by analogy with the entity\'s own outgoing exempt management fees.',
        source: 'inference',
        flag: true,
        flag_reason:
          'This entity issues exempt management fees (Art. 44) to its fund. This incoming non-EU advisory ' +
          'fee appears to be delegated fund management of similar nature and scale. Proposed as exempt. ' +
          'Confirm or change to RC_NONEU_TAX if this is general consulting.',
      };
    }
  }

  // ─── INFERENCE C: fund entity, EU, fund mgmt keywords without explicit exemption ───
  // Narrowed to `entity_type === 'fund'` only. The earlier rule accepted
  // `gp` too, but a GP is not a qualifying fund under BlackRock
  // (C-231/19) — it USES management services, it does not RECEIVE them
  // as a special investment fund.
  //
  // Also cancels when an exclusion keyword (training, SaaS, IT consulting,
  // legal/tax/audit advisory, etc.) is present — BlackRock holds that
  // services outside "specific and essential to fund management" fall
  // outside Art. 44§1 d.
  // isFundEntity covers both 'fund' and 'securitization_vehicle' per
  // Fiscale Eenheid X C-595/13 extension — see isQualifyingForArt44D.
  const isFundEntity = isQualifyingForArt44D(ctx);
  const isSvEntity = ctx.entity_type === 'securitization_vehicle';
  const hasFundMgmtKeywords = containsAny(text, FUND_MGMT_KEYWORDS) || containsAny(text, SECURITIZATION_MGMT_KEYWORDS);
  const hasExemptionReference = containsAny(text, EXEMPTION_KEYWORDS);
  const hasExclusionKeyword = containsAny(text, FUND_MGMT_EXCLUSION_KEYWORDS);

  if (isEu && isFundEntity && hasFundMgmtKeywords && !hasExemptionReference && !hasExclusionKeyword) {
    return {
      treatment: 'RC_EU_EX',
      rule: 'INFERENCE C',
      reason: 'Fund-type entity receiving a fund-management-like service — proposed exempt under Art. 44§1 d LTVA (BlackRock C-231/19 "specific and essential" test).',
      source: 'inference',
      flag: true,
      flag_reason:
        'Service description suggests fund management but invoice does not explicitly claim exemption. ' +
        'Confirm the service is "specific and essential to fund management" per BlackRock (C-231/19) — ' +
        'otherwise downgrade to RC_EU_TAX.',
    };
  }

  // ─── INFERENCE D: same as C but non-EU ───
  if (!isLu && !isEu && country !== '' && isFundEntity && hasFundMgmtKeywords && !hasExemptionReference && !hasExclusionKeyword) {
    return {
      treatment: 'RC_NONEU_EX',
      rule: 'INFERENCE D',
      reason: 'Fund-type entity receiving a fund-management-like service (non-EU) — proposed exempt under Art. 44§1 d LTVA.',
      source: 'inference',
      flag: true,
      flag_reason:
        'Service description suggests fund management (non-EU supplier). Non-EU advisors rarely cite ' +
        'Art. 44 on invoices, but the BlackRock (C-231/19) "specific and essential" test is substantive, ' +
        'not formal. Confirm before filing.',
    };
  }

  return null;
}

// ────────────────────────── Priority 5: fallback rules ──────────────────────────
function applyFallbackRules(line: InvoiceLineInput, ctx: EntityContext = {}): ClassificationResult | null {
  const country = (line.country || '').toUpperCase();
  const isLu = isLuxembourg(country);
  const isEu = isEU(country) && !isLu;
  const text = fullText(line);
  const entityType = ctx.entity_type;

  if (line.direction === 'incoming') {
    if (isLu && isZeroOrNull(line.vat_rate)) {
      // RULE 8 used to default to LUX_00 with the reason "Art. 44 exempt letting",
      // which silently mislabelled every LU invoice that happened to omit VAT.
      // We still default the treatment code to LUX_00 (so the amount lands in
      // an "exempt/no-VAT" bucket), but FLAG and require manual confirmation.
      return {
        treatment: 'LUX_00',
        rule: 'RULE 8',
        reason: 'Luxembourg supplier with no VAT charged — specific exemption basis not detectable from the invoice.',
        source: 'rule',
        flag: true,
        flag_reason:
          'LU supplier issued the invoice without VAT but no recognised legal reference ' +
          '(Art. 44, Art. 43, franchise threshold, out-of-scope) was found in the document. ' +
          'Confirm the correct exemption basis before filing.',
      };
    }

    // ═══════════════ Passive-holding gate (Polysar C-60/90 / Cibo C-16/00) ═══
    // A pure passive SOPARFI is NOT a taxable person — the supplier should
    // have charged origin-country VAT; the LU recipient does NOT reverse-
    // charge. Flag instead of classifying so the reviewer confirms the
    // entity's activity profile.
    if (entityType === 'passive_holding'
        && ((isEu && isZeroOrNull(line.vat_applied))
            || (!isLu && !isEu && country !== '' && isZeroOrNull(line.vat_applied)))) {
      const isHighRisk = containsAny(text, PASSIVE_HOLDING_HIGH_FLAG_KEYWORDS);
      return {
        treatment: null,
        rule: isEu ? 'RULE 11P' : 'RULE 13P',
        reason: 'Passive holding receiving a cross-border service — not a taxable person under Polysar (C-60/90) / Cibo Participations (C-16/00).',
        source: 'rule',
        flag: true,
        flag_reason:
          (isHighRisk
            ? 'High-risk service type (legal / tax / M&A / due diligence advisory) received by a PASSIVE holding. '
            : 'Cross-border service received by a PASSIVE holding. ')
          + 'The supplier should have charged origin-country VAT; there is no LU reverse-charge obligation. '
          + 'If the entity is in fact an ACTIVE holding (provides management / admin services to subsidiaries), '
          + 'change entity_type to "active_holding" and re-run classification (Marle Participations C-320/17).',
      };
    }

    // ═══════════════ RULES 11B/C/D — rate-split RC (EU) ═══════════════
    // Reverse-charge services normally at 17%, but reduced rates apply
    // to certain categories per Art. 40-1 LTVA. The RC rate is the LU
    // rate that would apply domestically (Art. 196 Directive).
    if (isEu && isZeroOrNull(line.vat_applied)) {
      if (containsAny(text, REDUCED_RATE_03_KEYWORDS)) {
        return ruleMatch('RULE 11D', 'RC_EU_TAX_03',
          'Reverse charge on services, super-reduced 3% rate applies domestically (Art. 40-1 LTVA; books / e-books / certain foodstuffs / pharmaceuticals).');
      }
      if (containsAny(text, REDUCED_RATE_08_KEYWORDS)) {
        return ruleMatch('RULE 11C', 'RC_EU_TAX_08',
          'Reverse charge on services, reduced 8% rate applies domestically (district heating, sports admission fees).');
      }
      if (containsAny(text, REDUCED_RATE_14_KEYWORDS)) {
        return ruleMatch('RULE 11B', 'RC_EU_TAX_14',
          'Reverse charge on services, intermediate 14% rate applies domestically.');
      }
      return ruleMatch('RULE 11', 'RC_EU_TAX', 'Reverse charge on services, Art. 17§1 LTVA transposing Art. 44 EU VAT Directive (general B2B rule) — eCDF boxes 436/462 at 17%.');
    }

    // ═══════════════ RULES 13B/C/D — rate-split RC (non-EU) ═══════════════
    if (!isLu && !isEu && country !== '' && isZeroOrNull(line.vat_applied)) {
      if (containsAny(text, REDUCED_RATE_03_KEYWORDS)) {
        return ruleMatch('RULE 13D', 'RC_NONEU_TAX_03',
          'Reverse charge on services from third country, super-reduced 3% rate applies (Art. 40-1 LTVA).');
      }
      if (containsAny(text, REDUCED_RATE_08_KEYWORDS)) {
        return ruleMatch('RULE 13C', 'RC_NONEU_TAX_08',
          'Reverse charge on services from third country, reduced 8% rate applies.');
      }
      if (containsAny(text, REDUCED_RATE_14_KEYWORDS)) {
        return ruleMatch('RULE 13B', 'RC_NONEU_TAX_14',
          'Reverse charge on services from third country, intermediate 14% rate applies.');
      }
      return ruleMatch('RULE 13', 'RC_NONEU_TAX', 'Reverse charge on services from third countries, Art. 17§1 LTVA — eCDF boxes 463/464 at 17%.');
    }
  }
  return null;
}

// Check whether two amounts are within the same order of magnitude.
// Tightened from the original ×10 tolerance to ×3: at ×10, an exempt
// outgoing total of €1m matched any incoming between €100k and €10m —
// too loose, produced many false-positive inferences.
function sameMagnitude(a: number | null | undefined, b: number | null | undefined): boolean {
  if (!a || !b) return false;
  const ra = Math.abs(Number(a));
  const rb = Math.abs(Number(b));
  if (ra === 0 || rb === 0) return false;
  const ratio = ra > rb ? ra / rb : rb / ra;
  return ratio <= 3;
}

function ruleMatch(ruleId: string, treatment: TreatmentCode, reason: string): ClassificationResult {
  return { treatment, rule: ruleId, reason, source: 'rule', flag: false };
}

// ────────────────────────── Provider-name normalisation ──────────────────────────
// Used for fuzzy-matching precedents by provider + country.
// LEGAL_SUFFIXES is now imported from exemption-keywords.ts so the
// director-kind detection and the normaliser stay in sync.
const COMMON_WORDS = ['luxembourg', 'the', 'and', 'de', 'des', 'du', 'la', 'le', 'les'];

export function normaliseProviderName(name: string | null | undefined): string {
  if (!name) return '';
  let s = name.toLowerCase();
  // strip diacritics
  s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  // remove punctuation (keep letters, digits, whitespace)
  s = s.replace(/[^a-z0-9\s]/g, ' ');
  // remove legal suffixes (as whole-word tokens)
  const tokens = s.split(/\s+/).filter(Boolean);
  const cleaned = tokens.filter(t => !(LEGAL_SUFFIXES as readonly string[]).includes(t) && !COMMON_WORDS.includes(t));
  return cleaned.join(' ').trim();
}

// ────────────────────────── Supplier-kind detection ──────────────────────────
// Distinguishes a natural-person supplier from a legal-person one,
// used by RULE 32 (director fees) to route C-288/22 TP (natural = not
// taxable) vs AED Circ. 781-2 contested position (legal = taxable).
//
// Strategy:
//  1. If the extractor explicitly provided `supplier_is_legal_person`,
//     trust it.
//  2. Otherwise tokenize the supplier name and check for a legal
//     suffix (SARL, SA, Ltd, GmbH…). If present → legal. If absent
//     AND the name looks like "FirstName LastName" (2-4 capitalised
//     tokens, no digits) → natural. Else → unknown.
//
// "Unknown" triggers a reviewer flag; the classifier does not guess.
export type SupplierKind = 'natural' | 'legal' | 'unknown';

export function detectSupplierKind(
  name: string | null | undefined,
  extractorHint: boolean | null | undefined = undefined,
): SupplierKind {
  if (extractorHint === true) return 'legal';
  if (extractorHint === false) return 'natural';
  if (!name) return 'unknown';

  const lower = name.toLowerCase();
  // strip diacritics + punctuation for tokenisation
  const normalised = lower
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const tokens = normalised.split(/\s+/).filter(Boolean);

  // Legal-suffix detection (whole-word match — 'sa' standalone is a
  // legal suffix; 'sandra' is not)
  const legalSuffixSet = new Set(LEGAL_SUFFIXES.map(s => s.toLowerCase()));
  if (tokens.some(t => legalSuffixSet.has(t))) return 'legal';
  // Also check multi-word suffixes ("sp z o o")
  const joined = tokens.join(' ');
  for (const s of LEGAL_SUFFIXES) {
    if (s.includes(' ') && joined.includes(s.toLowerCase())) return 'legal';
  }

  // Heuristic for natural person: 2-4 tokens, all-letter (no digits),
  // each token 2+ chars, no corporate keywords (bank, group, holding, etc).
  const CORPORATE_HINTS = ['bank', 'group', 'holding', 'capital', 'partners',
    'investments', 'fund', 'advisors', 'advisers', 'consulting',
    'management', 'associates', 'company', 'trust', 'services'];
  const hasCorporateHint = tokens.some(t => CORPORATE_HINTS.includes(t));
  const allLetters = tokens.every(t => /^[a-z][a-zà-ÿ'-]+$/i.test(t));
  if (!hasCorporateHint && allLetters && tokens.length >= 2 && tokens.length <= 4
      && tokens.every(t => t.length >= 2)) {
    return 'natural';
  }

  return 'unknown';
}

// ────────────────────────── Content-specific rules (PRIORITY 1.3) ──────────────────────────
// These fire before generic direct-evidence rules because they carry
// decisive content that would otherwise be steamrolled by rate/country
// heuristics. Each rule references the legal-source id in its reason
// string so the audit trail has the citation inline.
function applyContentSpecificRules(
  line: InvoiceLineInput,
  ctx: EntityContext,
): ClassificationResult | null {
  if (line.direction !== 'incoming') return null;
  const text = fullText(line);

  // ═══════════════ RULE 32 — Independent director fees ═══════════════
  // CJEU C-288/22 TP (2023-12-21) + AED Circ. 781-2 (2024).
  // Natural person → OUT_SCOPE (settled). Legal person → taxable with
  // a flag because the AED position is contested post-C-288/22.
  if (containsAny(text, DIRECTOR_FEE_KEYWORDS)) {
    const kind = detectSupplierKind(line.supplier_name, line.supplier_is_legal_person);
    const matched = findFirstMatch(text, DIRECTOR_FEE_KEYWORDS);

    if (kind === 'natural') {
      return {
        treatment: 'OUT_SCOPE',
        rule: 'RULE 32a',
        reason: `Director fee paid to a natural-person independent director — not a taxable person (CJEU C-288/22 TP, 2023-12-21; AED Circ. 781-2 post-2024). Keyword matched: "${matched}".`,
        source: 'rule',
        flag: false,
      };
    }

    if (kind === 'legal') {
      const country = (line.country || '').toUpperCase();
      const isLu = isLuxembourg(country);
      const isEu = isEU(country) && !isLu;
      // LU supplier → 17% VAT on the invoice (LUX_17).
      // EU supplier → reverse-charge (RC_EU_TAX).
      // Non-EU supplier → reverse-charge (RC_NONEU_TAX).
      let treatment: TreatmentCode = 'LUX_17';
      if (!isLu && isEu) treatment = 'RC_EU_TAX';
      else if (!isLu && !isEu && country !== '') treatment = 'RC_NONEU_TAX';

      return {
        treatment,
        rule: 'RULE 32b',
        reason: `Legal-person director fee — taxable per AED Circ. 781-2 post-2024 practice. The position is CONTESTED post-CJEU C-288/22 TP. Keyword matched: "${matched}".`,
        source: 'rule',
        flag: true,
        flag_reason:
          'AED maintains post-2024 that legal-person directors remain taxable persons (Circ. 781-2) — a position actively contested by LU practitioners. '
          + 'The argument: C-288/22 TP\'s collegial-body + no-personal-risk logic extends identically to a legal person acting in the same collegial role. '
          + 'Confirm the client\'s preferred treatment — some firms withhold VAT pending further CJEU clarification. '
          + 'Document the chosen position in the audit trail.',
      };
    }

    // Unknown supplier kind — flag for reviewer decision
    return {
      treatment: null,
      rule: 'RULE 32?',
      reason: `Director-fee keywords detected ("${matched}") but the supplier kind (natural vs legal person) could not be determined.`,
      source: 'rule',
      flag: true,
      flag_reason:
        'Director fees to natural persons are OUT_SCOPE (CJEU C-288/22 TP). Legal-person directors are taxable per AED Circ. 781-2 (contested). '
        + 'Identify the supplier kind and classify manually — either OUT_SCOPE (natural) or LUX_17 / RC_EU_TAX / RC_NONEU_TAX (legal).',
    };
  }

  // ═══════════════ RULE 33 — Carry interest ═══════════════
  // Always flagged. Default: OUT_SCOPE (investor-GP profit share).
  // Reviewer confirms against the LPA — re-classifies to LUX_17 if
  // the "carry" is actually a performance fee to a pure-service GP.
  if (containsAny(text, CARRY_INTEREST_KEYWORDS)) {
    const matched = findFirstMatch(text, CARRY_INTEREST_KEYWORDS);
    return {
      treatment: 'OUT_SCOPE',
      rule: 'RULE 33',
      reason: `Carry interest / performance allocation ("${matched}") — default OUT_SCOPE as a profit distribution on invested capital (Baštová C-432/15, Tolsma C-16/93; market practice PRAC_CARRY_INTEREST).`,
      source: 'rule',
      flag: true,
      flag_reason:
        'Carry analysis depends on economic substance, not invoice label. '
        + 'If the GP has an own economic participation (≥1% commitment alongside LPs), carry = profit share → OUT_SCOPE. '
        + 'If the GP is a pure-service GP (nominal commitment), carry = performance fee for services → LUX_17 (or EXEMPT_44 under Art. 44§1 d if qualifying fund delegate). '
        + 'Review the LPA / AIFM agreement before filing.',
    };
  }

  // ═══════════════ RULE 34 — Waterfall distributions ═══════════════
  // Profit distributions flowing through a fund waterfall are OUT_SCOPE
  // (return on capital, not a supply — Kretztechnik C-465/03). Embedded
  // "structuring fee" line items are independently taxable → handled
  // at the outer classification level by the rate rules.
  if (containsAny(text, WATERFALL_DISTRIBUTION_KEYWORDS)) {
    const matched = findFirstMatch(text, WATERFALL_DISTRIBUTION_KEYWORDS);
    // If a structuring-fee keyword is also present, flag as mixed — the
    // reviewer should split the line.
    const hasStructuringFee = containsAny(text, STRUCTURING_FEE_KEYWORDS);
    if (hasStructuringFee) {
      return {
        treatment: null,
        rule: 'RULE 34/mixed',
        reason: `Waterfall distribution line that also mentions a structuring / set-up fee — mixed characterisation.`,
        source: 'rule',
        flag: true,
        flag_reason:
          'The waterfall distribution portion is OUT_SCOPE (return on capital — Kretztechnik C-465/03); '
          + 'the structuring / set-up fee portion is TAXABLE 17% (service for consideration). '
          + 'Split the line into two: one OUT_SCOPE for the distribution, one LUX_17 for the fee.',
      };
    }

    return {
      treatment: 'OUT_SCOPE',
      rule: 'RULE 34',
      reason: `Waterfall distribution ("${matched}") — out of scope as a return on capital, not a supply (Kretztechnik C-465/03; market practice PRAC_WATERFALL_DISTRIBUTION).`,
      source: 'rule',
      flag: true,
      flag_reason:
        'Waterfall distributions to LPs / GP are out-of-scope profit distributions. '
        + 'Verify the line is pure distribution — if "structuring fee" / "set-up fee" wording is embedded, re-classify the fee portion as LUX_17.',
    };
  }

  // ═══════════════ RULE 35 — IGP / cost-sharing (Art. 44§1 y) ═══════════════
  // Narrowed by Kaplan C-77/19 (cross-border → taxable), DNB Banka +
  // Aviva (financial / insurance members → taxable). Classifier routes
  // by supplier country + entity_type.
  if (containsAny(text, IGP_KEYWORDS)) {
    const matched = findFirstMatch(text, IGP_KEYWORDS);
    const country = (line.country || '').toUpperCase();
    const isLu = isLuxembourg(country);
    const isEu = isEU(country) && !isLu;
    // Financial-sector member test per DNB Banka C-326/15 + Aviva C-605/15.
    // Includes fund / AIFM / ManCo and securitisation vehicles (also a
    // financial-sector classification).
    const isFinancialRecipient =
      ctx.entity_type === 'fund'
      || ctx.entity_type === 'manco'
      || ctx.entity_type === 'securitization_vehicle';

    // Cross-border IGP → never exempt (Kaplan)
    if (!isLu && country !== '') {
      const treatment: TreatmentCode = isEu ? 'RC_EU_TAX' : 'RC_NONEU_TAX';
      return {
        treatment,
        rule: 'RULE 35',
        reason: `Cross-border cost-sharing ("${matched}") — does not qualify for Art. 44§1 y exemption per CJEU Kaplan (C-77/19, 2020-11-18). Taxable at 17%.`,
        source: 'rule',
        flag: true,
        flag_reason:
          'The Art. 44§1 y IGP exemption applies ONLY when the group and its members are in the same Member State (Kaplan C-77/19). '
          + 'This cross-border invoice is reverse-charged at 17%. Confirm the invoice narrative does not disguise a non-IGP service.',
      };
    }

    // LU-to-LU IGP to a financial / fund member → not exempt (DNB Banka + Aviva)
    if (isLu && isFinancialRecipient) {
      return {
        treatment: 'LUX_17',
        rule: 'RULE 35-lu',
        reason: `LU-to-LU cost-sharing to a fund / financial-sector member ("${matched}") — the Art. 44§1 y exemption is excluded for financial + insurance sectors (CJEU DNB Banka C-326/15 + Aviva C-605/15). Taxable at 17%.`,
        source: 'rule',
        flag: true,
        flag_reason:
          'Per DNB Banka + Aviva, the IGP exemption is excluded for members active in the financial or insurance sector. '
          + 'This entity is classified as fund / manco and therefore falls in that sector. Confirm the invoice describes a genuine IGP arrangement — otherwise treat as a standard LU-VAT service.',
      };
    }

    // LU-to-LU IGP to a non-financial member → potentially exempt, flag the four conditions
    if (isLu && !isFinancialRecipient) {
      return {
        treatment: 'LUX_00',
        rule: 'RULE 35-ok',
        reason: `LU-to-LU cost-sharing ("${matched}") — potentially exempt under Art. 44§1 y LTVA if the four conditions are met.`,
        source: 'rule',
        flag: true,
        flag_reason:
          'Verify all four conditions BEFORE accepting the exemption: '
          + '(i) all members carry out exempt or non-taxable activities, '
          + '(ii) the services are directly necessary for those activities, '
          + '(iii) the group claims only reimbursement of the members\' share of joint expenses (no margin), '
          + '(iv) the exemption does not distort competition. '
          + 'Post-Commission v Luxembourg C-274/15, partial-taxable-activity members must be excluded.',
      };
    }
  }

  // ═══════════════ RULE 36 — Credit intermediation (Art. 44§1 (a)) ═══════════════
  // GC Versãofast T-657/24 (26 Nov 2025) materially widened the credit-
  // intermediation safe harbour under Art. 135(1)(b) Directive / Art. 44§1 (a)
  // LTVA. Mortgage brokers, loan-origination platforms, placement agents
  // for private debt, and chain sub-agents (Ludwig C-453/05) all qualify
  // when (i) the overall aim is to bring a lender + borrower into a
  // contract, (ii) the intermediary actively searches and recruits,
  // (iii) pre-contractual and administrative tasks are included. Binding
  // power over the credit institution is NOT required; professional status
  // is NOT required.
  //
  // Counter-examples still taxable: pure marketing / generic information,
  // data-enrichment sold to a bank, debt-collection (Aspiro C-40/15 —
  // handled separately on the SV servicer path in RULE 37).
  //
  // Priority note: when the extractor captured an explicit Art. 44§1 (a)
  // exemption reference, we DEFER to the direct-evidence rule (RULE 7A →
  // EXEMPT_44A_FIN) which emits the more specific treatment code with
  // proper Annexe B placement. RULE 36 fires for the keyword-only path.
  if (line.exemption_reference && containsAny(line.exemption_reference, ART_44_PARA_A_REFS)) {
    // Fall through — direct-evidence RULE 7A handles this case.
  } else if (containsAny(text, CREDIT_INTERMEDIATION_KEYWORDS)) {
    // Only applies when no VAT was actually charged (exempt = zero-rated).
    // If the supplier mistakenly charged VAT, fall through — the direct-
    // evidence rate rules will pick it up and the reviewer can manually
    // override to EXEMPT_44A_FIN after obtaining a corrected invoice.
    if (isZeroOrNull(line.vat_applied)) {
      const matched = findFirstMatch(text, CREDIT_INTERMEDIATION_KEYWORDS);
      const country = (line.country || '').toUpperCase();
      const isLu = isLuxembourg(country);
      const isEu = isEU(country) && !isLu;
      const flagText =
        'Versãofast (GC 2025-11-26) materially widened the credit-intermediation safe harbour: '
        + 'a broker who actively searches for and recruits customers for loan agreements qualifies '
        + 'even when (i) the intermediary cannot bind the credit institution, (ii) the mandate '
        + 'includes pre-contractual + administrative work, (iii) the intermediary is not a regulated '
        + 'professional. Confirm the invoice falls within this perimeter — NOT: pure marketing, '
        + 'generic information provision, data-enrichment sold to a bank, or debt-collection '
        + '(Aspiro C-40/15). If the supplier is a sub-agent to a broker, Ludwig C-453/05 extends '
        + 'the exemption to the sub-chain.';

      if (isLu) {
        return {
          treatment: 'LUX_00',
          rule: 'RULE 36',
          reason: `Credit intermediation ("${matched}") — exempt under Art. 44§1 (a) LTVA / Art. 135(1)(b) Directive 2006/112/EC (Versãofast T-657/24; Ludwig C-453/05).`,
          source: 'rule',
          flag: true,
          flag_reason: flagText,
        };
      }

      if (isEu) {
        return {
          treatment: 'RC_EU_EX',
          rule: 'RULE 36',
          reason: `Credit intermediation ("${matched}"), reverse-charge exempt under Art. 44§1 (a) LTVA (Versãofast T-657/24, GC 2025-11-26; EU supplier).`,
          source: 'rule',
          flag: true,
          flag_reason: flagText,
        };
      }

      if (!isLu && !isEu && country !== '') {
        return {
          treatment: 'RC_NONEU_EX',
          rule: 'RULE 36',
          reason: `Credit intermediation ("${matched}"), reverse-charge exempt under Art. 44§1 (a) LTVA (Versãofast T-657/24; non-EU supplier). Deduction may be available for LU recipient under Art. 49§2 non-EU exception.`,
          source: 'rule',
          flag: true,
          flag_reason: flagText,
        };
      }

      // Country missing — flag only, no treatment
      return {
        treatment: null,
        rule: 'RULE 36?',
        reason: `Credit intermediation keyword detected ("${matched}") but supplier country is missing.`,
        source: 'rule',
        flag: true,
        flag_reason:
          'Credit intermediation is potentially exempt under Art. 44§1 (a) LTVA post-Versãofast T-657/24. '
          + 'Capture the supplier country to apply the correct treatment (LUX_00 / RC_EU_EX / RC_NONEU_EX) '
          + 'or override manually with a documented basis.',
      };
    }
  }

  // ═══════════════ RULE 37 — Securitisation-vehicle servicer split ═══════════════
  // For entity_type = 'securitization_vehicle', a servicing / debt-collection
  // invoice carries a mixed character. Per Aspiro C-40/15, outsourced
  // handling that does not retain the "specific and essential" character
  // of the exempt underlying service is NOT exempt — debt collection is
  // the canonical example. Cifra refuses to auto-exempt and routes to
  // the reviewer for apportionment.
  if (ctx.entity_type === 'securitization_vehicle'
      && containsAny(text, SECURITIZATION_SERVICER_KEYWORDS)) {
    const matched = findFirstMatch(text, SECURITIZATION_SERVICER_KEYWORDS);
    return {
      treatment: null,
      rule: 'RULE 37',
      reason: `Servicer / debt-collection line on a securitisation vehicle ("${matched}") — mixed characterisation requires reviewer apportionment.`,
      source: 'rule',
      flag: true,
      flag_reason:
        'Servicer agreements for LU securitisation vehicles typically bundle (i) exempt management / cash-flow / '
        + 'reporting activities (Art. 44§1 d per Fiscale Eenheid X C-595/13) with (ii) taxable debt-collection / '
        + 'enforcement activities (Aspiro C-40/15 — back-office handling without the "specific and essential" '
        + 'character of the exempt service loses the exemption). Inspect the servicing agreement and split the fee: '
        + 'management-flavoured components (cash management, reporting, monitoring) → RC_EU_EX / RC_NONEU_EX / LUX_00; '
        + 'recovery / enforcement / delinquency-management components → LUX_17 / RC_EU_TAX / RC_NONEU_TAX. '
        + 'Document the apportionment methodology in the audit trail.',
    };
  }

  return null;
}

// Levenshtein distance (iterative DP). Used for precedent matching tolerance.
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array(b.length + 1).fill(0).map((_, i) => i);
  const curr = new Array(b.length + 1).fill(0);
  for (let i = 0; i < a.length; i++) {
    curr[0] = i + 1;
    for (let j = 0; j < b.length; j++) {
      const cost = a[i] === b[j] ? 0 : 1;
      curr[j + 1] = Math.min(
        curr[j] + 1,       // insertion
        prev[j + 1] + 1,   // deletion
        prev[j] + cost,    // substitution
      );
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}
