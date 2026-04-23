// ════════════════════════════════════════════════════════════════════════
// crm-firm-settings.ts
//
// Singleton lookup for the issuing firm's identity — consumed by the
// invoice PDF renderer and the /crm/settings/firm editor page. The
// row is seeded by migration 037 so `getFirmSettings()` never returns
// null after the migration is applied.
// ════════════════════════════════════════════════════════════════════════

import { queryOne } from '@/lib/db';

export interface FirmSettings {
  id: 'default';
  firm_name: string;
  firm_address_lines: string[];
  firm_vat_number: string | null;
  firm_matricule: string | null;
  firm_rcs_number: string | null;
  firm_email: string | null;
  firm_phone: string | null;
  firm_website: string | null;
  bank_name: string | null;
  bank_iban: string | null;
  bank_bic: string | null;
  payment_terms_days: number;
  footer_text: string | null;
  logo_data_url: string | null;
  updated_at: string;
}

/**
 * Fetch the singleton firm-settings row. Returns sensible defaults if
 * the row has somehow been deleted (migration 037 seeds it, so this
 * should never happen in practice — but we don't crash the PDF if it
 * does).
 */
export async function getFirmSettings(): Promise<FirmSettings> {
  const row = await queryOne<FirmSettings>(
    `SELECT id, firm_name, firm_address_lines, firm_vat_number, firm_matricule,
            firm_rcs_number, firm_email, firm_phone, firm_website,
            bank_name, bank_iban, bank_bic, payment_terms_days, footer_text,
            logo_data_url, updated_at::text AS updated_at
       FROM crm_firm_settings WHERE id = 'default'`,
  );
  if (row) return row;
  // Fallback: never hit in practice post-migration 037.
  return {
    id: 'default',
    firm_name: 'My Firm',
    firm_address_lines: [],
    firm_vat_number: null,
    firm_matricule: null,
    firm_rcs_number: null,
    firm_email: null,
    firm_phone: null,
    firm_website: null,
    bank_name: null,
    bank_iban: null,
    bank_bic: null,
    payment_terms_days: 30,
    footer_text: null,
    logo_data_url: null,
    updated_at: new Date().toISOString(),
  };
}
