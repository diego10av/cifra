// Benchmark tests for the deterministic classification engine.
//
// These cases come from the PRD reference scenarios (anonymised). Every time
// the rules engine is touched, run `npm test` to confirm the previously known
// classifications still produce the expected treatment + rule.
//
// Add new cases when:
//  - You correct a misclassification (capture the input + the right answer)
//  - A new legal position changes treatment for a class of invoices
//  - A new keyword is added to one of the dictionaries

import { describe, it, expect } from 'vitest';
import {
  classifyInvoiceLine,
  type EntityContext,
  type InvoiceLineInput,
} from '@/config/classification-rules';

const FUND_CTX: EntityContext = {
  entity_type: 'fund',
  exempt_outgoing_total: 1_500_000,
};
const HOLDING_CTX: EntityContext = {
  entity_type: 'active_holding',
  exempt_outgoing_total: 0,
};

function inv(overrides: Partial<InvoiceLineInput>): InvoiceLineInput {
  return {
    direction: 'incoming',
    country: 'LU',
    vat_rate: null,
    vat_applied: null,
    amount_eur: 1000,
    description: '',
    invoice_text: null,
    ...overrides,
  };
}

describe('Direct evidence rules (priority 2)', () => {
  it('RULE 1 — LU + 17% → LUX_17', () => {
    const r = classifyInvoiceLine(inv({ country: 'LU', vat_rate: 0.17 }));
    expect(r.treatment).toBe('LUX_17');
    expect(r.rule).toBe('RULE 1');
  });

  it('RULE 2 — LU + 14% → LUX_14 (depositary)', () => {
    const r = classifyInvoiceLine(inv({ country: 'LU', vat_rate: 0.14 }));
    expect(r.treatment).toBe('LUX_14');
    expect(r.rule).toBe('RULE 2');
  });

  it('RULE 3 — LU + 8% → LUX_08', () => {
    const r = classifyInvoiceLine(inv({ country: 'LU', vat_rate: 0.08 }));
    expect(r.treatment).toBe('LUX_08');
  });

  it('RULE 4 — LU + 3% → LUX_03', () => {
    const r = classifyInvoiceLine(inv({ country: 'LU', vat_rate: 0.03 }));
    expect(r.treatment).toBe('LUX_03');
  });

  it('RULE 5 — LU + null + "Office rent" → LUX_00 (Art 44§1 b)', () => {
    const r = classifyInvoiceLine(inv({ country: 'LU', description: 'Office rent Q1 2025' }));
    expect(r.treatment).toBe('LUX_00');
    expect(r.rule).toBe('RULE 5');
  });

  it('RULE 6 — LU + "Cotisation Chambre de Commerce" → OUT_SCOPE', () => {
    const r = classifyInvoiceLine(inv({
      country: 'LU',
      description: 'Cotisation minimale annuelle 2025 - Chambre de Commerce',
    }));
    expect(r.treatment).toBe('OUT_SCOPE');
    expect(r.rule).toBe('RULE 6');
  });

  it('RULE 6 — LU + "CSSF subscription fee" → OUT_SCOPE', () => {
    const r = classifyInvoiceLine(inv({
      country: 'LU',
      description: 'CSSF annual subscription fee',
    }));
    expect(r.treatment).toBe('OUT_SCOPE');
  });

  it('RULE 7 — LU + null + Art 44 in invoice text → EXEMPT_44', () => {
    const r = classifyInvoiceLine(inv({
      country: 'LU',
      description: 'Investment management services Q1',
      invoice_text: 'Invoice exempt under Article 44 LTVA',
    }));
    expect(r.treatment).toBe('EXEMPT_44');
    expect(r.rule).toBe('RULE 7');
  });

  it('RULE 8 — LU + null + no keyword → LUX_00 but FLAGGED for manual review', () => {
    // The treatment still defaults to LUX_00 so the amount lands in the
    // exempt/no-VAT bucket, but the line must carry flag=true because we
    // cannot identify the actual legal basis from the invoice alone
    // (could be Art. 44, franchise threshold, out-of-scope, missing VAT).
    const r = classifyInvoiceLine(inv({ country: 'LU', description: 'Annex IV reporting' }));
    expect(r.treatment).toBe('LUX_00');
    expect(r.rule).toBe('RULE 8');
    expect(r.flag).toBe(true);
    expect(r.flag_reason).toBeTruthy();
  });

  it('RULE 9 — EU + "goods", no readable rate → IC_ACQ (generic fallback)', () => {
    const r = classifyInvoiceLine(inv({
      country: 'BE', description: 'Purchase of office equipment goods',
    }));
    expect(r.treatment).toBe('IC_ACQ');
    expect(r.rule).toBe('RULE 9');
  });
});

// ════════════════ Batch 6 — new direct-evidence rules (16-19) ════════════════
describe('Batch 6 rules (16-19)', () => {
  // ─── RULE 16 — extractor-flagged disbursement ───
  it('RULE 16 — is_disbursement=true → DEBOURS, regardless of country / rate', () => {
    const r = classifyInvoiceLine(inv({
      country: 'LU', description: 'Notary — registration duties', is_disbursement: true,
    }));
    expect(r.treatment).toBe('DEBOURS');
    expect(r.rule).toBe('RULE 16');
  });

  it('RULE 16 beats a LU-17% VAT rate (extractor signal is authoritative)', () => {
    // A disbursement flag is stronger than a rate — some invoices print a
    // rate on every line but disbursements are out-of-scope.
    const r = classifyInvoiceLine(inv({
      country: 'LU', vat_rate: 0.17, description: 'Débours', is_disbursement: true,
    }));
    expect(r.treatment).toBe('DEBOURS');
  });

  // ─── RULE 17 — IC acquisitions by rate ───
  it('RULE 17 — EU + goods + 17% → IC_ACQ_17', () => {
    const r = classifyInvoiceLine(inv({
      country: 'DE', description: 'Purchase of server hardware goods', vat_rate: 0.17,
    }));
    expect(r.treatment).toBe('IC_ACQ_17');
    expect(r.rule).toBe('RULE 17');
  });

  it('RULE 17 — EU + goods + 3% → IC_ACQ_03', () => {
    const r = classifyInvoiceLine(inv({
      country: 'FR', description: 'Purchase of books (livres) goods', vat_rate: 0.03,
    }));
    expect(r.treatment).toBe('IC_ACQ_03');
  });

  // ─── RULE 18 — outgoing to non-EU customer ───
  it('RULE 18 — non-EU customer WITH VAT-ID → OUT_NONEU', () => {
    // Batch E-1 finding: Art. 17§2 LTVA shifts B2C supplies back into LU
    // scope. OUT_NONEU is only safe when we have evidence the customer is
    // a taxable person, typically a VAT-ID or equivalent.
    const r = classifyInvoiceLine(inv({
      direction: 'outgoing', country: 'LU',
      customer_country: 'US', customer_vat: 'US EIN 12-3456789',
      vat_rate: 0, vat_applied: 0, description: 'Advisory services',
    }));
    expect(r.treatment).toBe('OUT_NONEU');
    expect(r.rule).toBe('RULE 18');
  });

  it('RULE 18X — non-EU customer WITHOUT VAT-ID → flagged, not auto-classified', () => {
    // A non-EU customer with no business-status evidence could be a B2C
    // consumer, in which case Art. 17§2 LTVA makes the supply LU-taxable.
    // Auto-exempting would under-collect 17% output VAT.
    const r = classifyInvoiceLine(inv({
      direction: 'outgoing', country: 'LU', customer_country: 'US',
      vat_rate: 0, vat_applied: 0, description: 'Advisory services',
    }));
    expect(r.treatment).toBeNull();
    expect(r.rule).toBe('RULE 18X');
    expect(r.flag).toBe(true);
  });

  it('RULE 18 does NOT fire when the invoice is billed with 17% VAT', () => {
    const r = classifyInvoiceLine(inv({
      direction: 'outgoing', country: 'LU', customer_country: 'CH',
      vat_rate: 0.17, description: 'Taxable services',
    }));
    // 17% VAT was actually charged — the supply is taxable LU, not OUT_NONEU.
    expect(r.treatment).toBe('OUT_LUX_17');
    expect(r.rule).toBe('RULE 15');
  });

  it('RULE 18 does NOT fire for EU customer (that would be OUT_EU_RC territory)', () => {
    const r = classifyInvoiceLine(inv({
      direction: 'outgoing', country: 'LU', customer_country: 'DE',
      vat_rate: 0, description: 'Consulting services',
    }));
    expect(r.treatment).not.toBe('OUT_NONEU');
  });

  // ─── RULE 19 — import VAT flag-only (Batch E-1 fix) ───
  it('RULE 19 — non-EU supplier VAT is FLAGGED, not auto-deducted', () => {
    // Batch E-1 CRITICAL finding: VAT on a non-EU supplier invoice is
    // foreign VAT, not LU import VAT. LU import VAT comes from the
    // customs declaration (DAU), not the commercial invoice. The earlier
    // auto-deduction created Art. 70 LTVA exposure (10-50% penalties).
    const r = classifyInvoiceLine(inv({
      country: 'CN', description: 'Purchase of goods (industrial equipment)',
      vat_applied: 170, amount_eur: 1000,
    }));
    expect(r.treatment).toBeNull();
    expect(r.rule).toBe('RULE 19');
    expect(r.flag).toBe(true);
    expect(r.flag_reason).toMatch(/foreign VAT|customs declaration|DAU/i);
  });

  it('RULE 19 does NOT fire for non-EU services with no VAT (that is RC_NONEU_*)', () => {
    const r = classifyInvoiceLine(inv({
      country: 'CH', description: 'Consulting services', vat_applied: null,
    }));
    expect(r.treatment).not.toBe('IMPORT_VAT');
  });
});

// ════════════════ Batch E-1 Opus fiscal audit regressions ════════════════
describe('Batch E-1 audit fixes', () => {
  it('Domiciliation invoice must NOT be exempt — AED Circ. 764 taxable at 17%', () => {
    // Previously "domiciliation" lived in REAL_ESTATE_KEYWORDS, causing
    // every SOPARFI domiciliation invoice (Circ. 764 service) to be
    // silently exempted as Art. 44§1 b letting.
    const r = classifyInvoiceLine(inv({
      country: 'LU',
      description: 'Domiciliation services Q1 2025',
      vat_rate: 0, vat_applied: 0,
    }));
    expect(r.treatment).toBe('LUX_17');
    expect(r.rule).toBe('RULE 5D');
    expect(r.flag).toBe(true);
  });

  it('Real-estate carve-out (parking) must NOT be Art. 44§1 b exempt', () => {
    const r = classifyInvoiceLine(inv({
      country: 'LU',
      description: 'Parking space rental — underground',
      vat_rate: 0, vat_applied: 0,
    }));
    expect(r.treatment).toBe('LUX_17');
    expect(r.rule).toBe('RULE 5C');
  });

  it('Extractor-captured Art. 44§1 a reference → EXEMPT_44A_FIN', () => {
    const r = classifyInvoiceLine(inv({
      country: 'LU',
      description: 'Custodian fees',
      exemption_reference: 'Art. 44§1 a LTVA',
      vat_rate: 0, vat_applied: 0,
    }));
    expect(r.treatment).toBe('EXEMPT_44A_FIN');
    expect(r.rule).toBe('RULE 7A');
  });

  it('Extractor-captured Art. 44§1 b reference → EXEMPT_44B_RE', () => {
    const r = classifyInvoiceLine(inv({
      country: 'LU',
      description: 'Office lease Q1',
      exemption_reference: 'Art. 44 § 1 b LTVA',
      vat_rate: 0, vat_applied: 0,
    }));
    expect(r.treatment).toBe('EXEMPT_44B_RE');
    expect(r.rule).toBe('RULE 7B');
  });

  it('Extractor-captured Art. 45 opt-in on 17% outgoing → OUT_LUX_17_OPT', () => {
    const r = classifyInvoiceLine(inv({
      direction: 'outgoing', country: 'LU',
      description: 'Office rental with Art. 45 opt-in',
      exemption_reference: 'Art. 45 LTVA — option pour la taxation',
      vat_rate: 0.17,
    }));
    expect(r.treatment).toBe('OUT_LUX_17_OPT');
    expect(r.rule).toBe('RULE 15A');
  });

  it('Bare "cssf" no longer triggers OUT_SCOPE (third-party invoice)', () => {
    // A law firm's invoice "CSSF filing assistance" is taxable at 17%,
    // not out of scope. The tightened keyword list requires the specific
    // public-authority phrase, not the bare regulator name.
    const r = classifyInvoiceLine(inv({
      country: 'LU', description: 'Legal fees — CSSF filing assistance',
      vat_rate: 0, vat_applied: 0,
    }));
    // Should fall through to RULE 8 (flagged LU no-VAT) rather than
    // silently exempting.
    expect(r.treatment).not.toBe('OUT_SCOPE');
  });

  it('"cssf supervisory fee" still triggers OUT_SCOPE', () => {
    const r = classifyInvoiceLine(inv({
      country: 'LU', description: 'CSSF supervisory fee 2025',
      vat_rate: 0, vat_applied: 0,
    }));
    expect(r.treatment).toBe('OUT_SCOPE');
    expect(r.rule).toBe('RULE 6');
  });

  it('INFERENCE E — legal advisory from EU supplier to fund entity → RC_EU_TAX (taxable backstop)', () => {
    // Legal services are taxable regardless of recipient. Without the
    // backstop, INFERENCE C would have exempted this because the fund
    // entity + generic "advisory" description match FUND_MGMT_KEYWORDS.
    const r = classifyInvoiceLine(
      inv({
        country: 'DE',
        description: 'Legal advisory on fund structuring',
      }),
      FUND_CTX,
    );
    expect(r.treatment).toBe('RC_EU_TAX');
    expect(r.rule).toBe('INFERENCE E');
    expect(r.flag).toBe(true);
  });

  it('INFERENCE C cancelled by exclusion keyword (SaaS)', () => {
    // BlackRock (C-231/19): generic IT / SaaS is not "specific and
    // essential to fund management". Must not auto-exempt.
    const r = classifyInvoiceLine(
      inv({
        country: 'IE',
        description: 'Portfolio management SaaS licence',
      }),
      FUND_CTX,
    );
    expect(r.rule).not.toBe('INFERENCE C');
  });

  it('Franchise-threshold LU supplier → LUX_00 via RULE 23', () => {
    const r = classifyInvoiceLine(inv({
      country: 'LU',
      description: 'Service — régime de la franchise Art. 57',
      vat_rate: 0, vat_applied: 0,
    }));
    expect(r.treatment).toBe('LUX_00');
    expect(r.rule).toBe('RULE 23');
  });
});

// ════════════════ Option B — new rules 20-32 + audit hardening ════════════════
describe('Batch B rules (20-32 + hardening)', () => {
  // ─── RULE 20 — VAT group ───
  it('RULE 20 — entity in VAT group, LU no-VAT incoming → VAT_GROUP_OUT (flagged)', () => {
    const r = classifyInvoiceLine(
      inv({ country: 'LU', description: 'Intra-group accounting service', vat_rate: 0, vat_applied: 0 }),
      { entity_type: 'active_holding', vat_group_id: 'LUGRP12345' },
    );
    expect(r.treatment).toBe('VAT_GROUP_OUT');
    expect(r.rule).toBe('RULE 20');
    expect(r.flag).toBe(true);
    expect(r.flag_reason).toMatch(/LUGRP12345/);
  });

  // ─── RULE 22 — Platform deemed supplier ───
  it('RULE 22 — "marketplace facilitator" keyword → PLATFORM_DEEMED', () => {
    const r = classifyInvoiceLine(inv({
      country: 'IE',
      description: 'Platform fee — marketplace facilitator Art. 9a',
    }));
    expect(r.treatment).toBe('PLATFORM_DEEMED');
    expect(r.rule).toBe('RULE 22');
    expect(r.flag).toBe(true);
  });

  // ─── RULE 24 — Margin scheme ───
  it('RULE 24 — "régime de la marge" → MARGIN_NONDED (buyer cannot deduct)', () => {
    const r = classifyInvoiceLine(inv({
      country: 'FR',
      description: 'Purchase of second-hand goods — régime de la marge',
      vat_applied: 0, amount_eur: 1000,
    }));
    expect(r.treatment).toBe('MARGIN_NONDED');
    expect(r.rule).toBe('RULE 24');
    expect(r.flag).toBe(true);
  });

  // ─── RULE 25 — Domestic RC on construction ───
  it('RULE 25 — LU construction work, no VAT → RC_LUX_CONSTR_17', () => {
    const r = classifyInvoiceLine(inv({
      country: 'LU',
      description: 'Travaux de construction — gros œuvre Q1 2026',
      vat_rate: 0, vat_applied: 0,
    }));
    expect(r.treatment).toBe('RC_LUX_CONSTR_17');
    expect(r.rule).toBe('RULE 25');
    expect(r.flag).toBe(true);
  });

  // ─── RULE 26 — Domestic RC on scrap / emission ───
  it('RULE 26 — LU emission-allowance supply, no VAT → RC_LUX_SPEC_17', () => {
    const r = classifyInvoiceLine(inv({
      country: 'LU',
      description: 'Sale of CO2 allowance to LU acquirer',
      vat_rate: 0, vat_applied: 0,
    }));
    expect(r.treatment).toBe('RC_LUX_SPEC_17');
    expect(r.rule).toBe('RULE 26');
  });

  // ─── RULE 27 — Bad-debt relief ───
  it('RULE 27 — "créance irrécouvrable" → BAD_DEBT_RELIEF (flagged)', () => {
    const r = classifyInvoiceLine(inv({
      country: 'LU',
      description: 'Régularisation — créance irrécouvrable suite à faillite',
    }));
    expect(r.treatment).toBe('BAD_DEBT_RELIEF');
    expect(r.rule).toBe('RULE 27');
    expect(r.flag).toBe(true);
  });

  // ─── RULE 29 — Non-deductible LU input VAT ───
  it('RULE 29 — LU 17% on "repas d\'affaires" → LUX_17_NONDED', () => {
    const r = classifyInvoiceLine(inv({
      country: 'LU',
      description: 'Restaurant — repas d\'affaires avec un client potentiel',
      vat_rate: 0.17,
    }));
    expect(r.treatment).toBe('LUX_17_NONDED');
    expect(r.rule).toBe('RULE 29');
    expect(r.flag).toBe(true);
  });

  it('RULE 29 does NOT fire for ordinary LU 17% services', () => {
    const r = classifyInvoiceLine(inv({
      country: 'LU',
      description: 'Consulting services Q1',
      vat_rate: 0.17,
    }));
    expect(r.treatment).toBe('LUX_17');
    expect(r.rule).toBe('RULE 1');
  });

  // ─── RULE 31 — Autolivraison ───
  it('RULE 31 — self_supply_mentioned=true outgoing → AUTOLIV_17', () => {
    const r = classifyInvoiceLine(inv({
      direction: 'outgoing', country: 'LU',
      description: 'Self-supply for private use of business asset',
      // @ts-expect-error — extended field from the extractor
      self_supply_mentioned: true,
    }));
    expect(r.treatment).toBe('AUTOLIV_17');
    expect(r.rule).toBe('RULE 31');
  });

  // ─── Rate-split reverse-charge RULES 11B/C/D (EU) ───
  it('RULE 11D — EU supplier, e-book service, no VAT → RC_EU_TAX_03', () => {
    const r = classifyInvoiceLine(inv({
      country: 'IE',
      description: 'E-book licence annual subscription',
    }));
    expect(r.treatment).toBe('RC_EU_TAX_03');
    expect(r.rule).toBe('RULE 11D');
  });

  it('RULE 11C — EU supplier, district heating, no VAT → RC_EU_TAX_08', () => {
    const r = classifyInvoiceLine(inv({
      country: 'DE',
      description: 'District heating supply Q1 2026',
    }));
    expect(r.treatment).toBe('RC_EU_TAX_08');
    expect(r.rule).toBe('RULE 11C');
  });

  it('RULE 11 — generic EU service no VAT (no backstop trigger) → RC_EU_TAX (17% default)', () => {
    const r = classifyInvoiceLine(inv({
      country: 'NL',
      description: 'Cloud hosting monthly subscription',
    }));
    expect(r.treatment).toBe('RC_EU_TAX');
    expect(r.rule).toBe('RULE 11');
  });

  // ─── Rate-split reverse-charge RULES 13D (non-EU) ───
  it('RULE 13D — Non-EU supplier, e-book → RC_NONEU_TAX_03', () => {
    const r = classifyInvoiceLine(inv({
      country: 'US',
      description: 'E-book annual subscription',
    }));
    expect(r.treatment).toBe('RC_NONEU_TAX_03');
    expect(r.rule).toBe('RULE 13D');
  });

  // ─── Passive-holding gate ───
  it('Passive holding + EU service → flag-only, no auto-RC (Polysar)', () => {
    const r = classifyInvoiceLine(
      inv({ country: 'FR', description: 'Legal advisory on M&A due diligence' }),
      { entity_type: 'passive_holding' },
    );
    expect(r.treatment).toBeNull();
    expect(r.rule).toBe('RULE 11P');
    expect(r.flag).toBe(true);
    expect(r.flag_reason).toMatch(/passive|Polysar|Cibo/i);
  });

  it('Passive holding + non-EU service → flag-only RULE 13P', () => {
    const r = classifyInvoiceLine(
      inv({ country: 'CH', description: 'Swiss consulting' }),
      { entity_type: 'passive_holding' },
    );
    expect(r.treatment).toBeNull();
    expect(r.rule).toBe('RULE 13P');
  });

  it('Active holding + EU service → normal RC_EU_TAX', () => {
    const r = classifyInvoiceLine(
      inv({ country: 'FR', description: 'Legal advisory services' }),
      { entity_type: 'active_holding' },
    );
    // Either INFERENCE E (taxable backstop) for legal advisory, or RULE 11
    expect(['RC_EU_TAX']).toContain(r.treatment);
  });
});

describe('Reverse charge rules', () => {
  it('RULE 10 — EU + fund-mgmt + Art 44, entity IS a fund → RC_EU_EX', () => {
    // Batch E-1 CRITICAL fix: the Art. 44§1 d fund-management exemption
    // applies only to qualifying special investment funds per CJEU
    // BlackRock (C-231/19) and Fiscale Eenheid X (C-595/13).
    const r = classifyInvoiceLine(
      inv({
        country: 'DE',
        description: 'AIFM management services Q1 - exonéré Art. 44',
        invoice_text: 'Exempt from VAT under Article 44',
      }),
      FUND_CTX,
    );
    expect(r.treatment).toBe('RC_EU_EX');
    expect(r.rule).toBe('RULE 10');
  });

  it('RULE 10X — same invoice received by a NON-fund entity → RC_EU_TAX (flagged)', () => {
    // SOPARFI / active-holding cannot claim Art. 44§1 d. Must reverse-
    // charge at 17% per Art. 17§1 LTVA. This was the CRITICAL finding
    // of the E-1 audit (AED Art. 70 penalty exposure).
    const r = classifyInvoiceLine(
      inv({
        country: 'DE',
        description: 'AIFM management services Q1 - exonéré Art. 44',
        invoice_text: 'Exempt from VAT under Article 44',
      }),
      HOLDING_CTX,
    );
    expect(r.treatment).toBe('RC_EU_TAX');
    expect(r.rule).toBe('RULE 10X');
    expect(r.flag).toBe(true);
    expect(r.flag_reason).toMatch(/BlackRock|qualifying|fund/i);
  });

  it('RULE 11 — EU services with no VAT, no exemption → RC_EU_TAX', () => {
    const r = classifyInvoiceLine(inv({
      country: 'PL', description: 'Investment advisory fee Q1 2025',
    }));
    // Without entity context, no inference; falls through to fallback
    expect(r.treatment).toBe('RC_EU_TAX');
    expect(r.rule).toBe('RULE 11');
  });

  it('RULE 13 — Non-EU services with no VAT → RC_NONEU_TAX', () => {
    const r = classifyInvoiceLine(inv({
      country: 'GB', description: 'Travel recovery service',
    }));
    expect(r.treatment).toBe('RC_NONEU_TAX');
    expect(r.rule).toBe('RULE 13');
  });
});

describe('Inference rules (priority 4)', () => {
  it('INFERENCE A — EU advisory matching outgoing exempt pattern → RC_EU_EX (flagged)', () => {
    // FUND_CTX has exempt_outgoing_total = 1_500_000. Under the new
    // tightened sameMagnitude (×3, down from ×10), the incoming amount
    // must be within 500k..4.5M. Use 800k (ratio 1.875).
    const r = classifyInvoiceLine(
      inv({
        country: 'PL',
        description: 'Investment advisory fee III Q 2025',
        amount_eur: 800_000,
      }),
      FUND_CTX
    );
    expect(r.treatment).toBe('RC_EU_EX');
    expect(r.rule).toBe('INFERENCE A');
    expect(r.flag).toBe(true);
    expect(r.source).toBe('inference');
  });

  it('INFERENCE A does NOT fire when magnitude ratio exceeds ×3 (tightened)', () => {
    // Batch E-1: old ×10 was too loose — a 100k incoming and a 1M
    // exempt outgoing matched, producing many false-positive inferences.
    const r = classifyInvoiceLine(
      inv({
        country: 'PL',
        description: 'Investment advisory fee III Q 2025',
        amount_eur: 300_000, // ratio 5× against 1.5M FUND_CTX outgoing
      }),
      FUND_CTX
    );
    expect(r.rule).not.toBe('INFERENCE A');
  });

  it('INFERENCE A skips when amount magnitude is too different (and entity is not fund-type)', () => {
    // Outgoing exempt = 0 (holding context), so INFERENCE A's magnitude check fails.
    // Holding entity_type also fails INFERENCE C's fund/gp check. Falls through to RULE 11.
    const r = classifyInvoiceLine(
      inv({
        country: 'PL',
        description: 'Investment advisory fee tiny',
        amount_eur: 50,
      }),
      HOLDING_CTX
    );
    expect(r.treatment).toBe('RC_EU_TAX');
    expect(r.rule).toBe('RULE 11');
  });

  it('INFERENCE C — fund entity + EU + fund-mgmt keywords + no exemption → RC_EU_EX', () => {
    const r = classifyInvoiceLine(
      inv({
        country: 'DE',
        description: 'Sub-advisory fees for the fund',
      }),
      FUND_CTX
    );
    expect(r.treatment).toBe('RC_EU_EX');
    expect(r.rule).toBe('INFERENCE C');
  });

  it('INFERENCE C does not fire for non-fund entities', () => {
    const r = classifyInvoiceLine(
      inv({
        country: 'DE',
        description: 'Sub-advisory fees',
      }),
      HOLDING_CTX
    );
    // Falls through to RULE 11
    expect(r.treatment).toBe('RC_EU_TAX');
    expect(r.rule).toBe('RULE 11');
  });

  it('INFERENCE D — non-EU version of C → RC_NONEU_EX', () => {
    const r = classifyInvoiceLine(
      inv({
        country: 'CH',
        description: 'AIFM portfolio management services',
      }),
      FUND_CTX
    );
    expect(r.treatment).toBe('RC_NONEU_EX');
    expect(r.rule).toBe('INFERENCE D');
  });
});

describe('Outgoing rules', () => {
  it('RULE 14 — outgoing + no VAT + explicit Art. 44 reference → OUT_LUX_00', () => {
    const r = classifyInvoiceLine(inv({
      direction: 'outgoing', country: 'LU',
      vat_rate: 0, vat_applied: 0,
      description: 'Management fee Q1 2025 — exempt under Art. 44 LTVA',
    }));
    expect(r.treatment).toBe('OUT_LUX_00');
    expect(r.rule).toBe('RULE 14');
  });

  it('RULE 14 does NOT match a bare "management fee" description (no legal reference)', () => {
    // Regression: the earlier loose RULE 14 silently exempted any outgoing
    // containing "management fee". That caused taxable advisory fees billed
    // at 17% to be mis-classified as exempt. The tightened RULE 14 now
    // requires an explicit exemption reference AND no VAT charged.
    const r = classifyInvoiceLine(inv({
      direction: 'outgoing', country: 'LU',
      description: 'Management fee Q1 2025',
    }));
    expect(r.treatment).not.toBe('OUT_LUX_00');
  });

  it('RULE 14 does NOT match an outgoing "management fee" billed with 17% VAT', () => {
    const r = classifyInvoiceLine(inv({
      direction: 'outgoing', country: 'LU',
      vat_rate: 0.17,
      description: 'Management fee Q1 2025 — exonéré de TVA',
    }));
    // vat_rate = 17% must win over the exemption phrase
    expect(r.treatment).toBe('OUT_LUX_17');
    expect(r.rule).toBe('RULE 15');
  });

  it('RULE 15 — outgoing + 17% → OUT_LUX_17', () => {
    const r = classifyInvoiceLine(inv({
      direction: 'outgoing', country: 'LU', vat_rate: 0.17,
      description: 'Consulting services Q1',
    }));
    expect(r.treatment).toBe('OUT_LUX_17');
  });
});

describe('Manual classifications are protected', () => {
  // Note: 'manual' protection lives in lib/classify.ts (the runner), not in
  // classifyInvoiceLine itself. This is documentation of that contract.
  it('classifyInvoiceLine never returns source="manual" — that is set by the user', () => {
    const r = classifyInvoiceLine(inv({ country: 'LU', vat_rate: 0.17 }));
    expect(r.source).not.toBe('manual');
  });
});

describe('Multi-language exemption keywords (FIX 9)', () => {
  it.each([
    ['exempt from VAT', 'EN'],
    ['exonéré de TVA', 'FR'],
    ['steuerbefreit', 'DE'],
    ['esente IVA', 'IT'],
    ['exento de IVA', 'ES'],
    ['zwolniony z VAT', 'PL'],
    ['vrijgesteld van BTW', 'NL'],
    ['isento de IVA', 'PT'],
  ])('triggers EXEMPT_44 when invoice_text contains "%s" (%s)', (phrase) => {
    const r = classifyInvoiceLine(inv({
      country: 'LU',
      description: 'Investment management services',
      invoice_text: `Note: ${phrase}`,
    }));
    expect(r.treatment).toBe('EXEMPT_44');
    expect(r.rule).toBe('RULE 7');
  });
});

describe('No match', () => {
  it('returns NO_MATCH and flags for review when nothing fits', () => {
    const r = classifyInvoiceLine(inv({
      // Empty country = falls through every country-gated rule (LU, EU, non-EU).
      // Zero VAT + no exemption/RC keyword = falls through every zero-VAT service rule.
      // RULE 11X (added for "foreign supplier charged VAT on a service") would fire on
      // 'XX' + vat_applied > 0 — so for a true NO_MATCH we need empty country OR zero VAT.
      country: '',
      vat_rate: null, vat_applied: 0,
      description: 'Mystery line',
    }));
    expect(r.treatment).toBeNull();
    expect(r.rule).toBe('NO_MATCH');
    expect(r.flag).toBe(true);
  });
});
