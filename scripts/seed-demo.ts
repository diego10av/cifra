// ════════════════════════════════════════════════════════════════════════
// Demo seed — populates a dev DB with realistic LU fiduciary data so
// Diego (and his potential partner) can test the UI end-to-end without
// having to upload real documents or spend Anthropic budget on dummy
// extractions.
//
// What it creates:
//   - 2 clients, one of which (Acme Capital Group) is the
//     multi-entity case (2 entities under one client) so Diego can
//     demo the "Avallon-style" model.
//   - 3 entities covering the three archetypes we actually target:
//       * SOPARFI (simplified regime, annual)       — Acme
//       * AIFM SCSp (ordinary, quarterly)           — Horizon
//       * Holding SARL (ordinary, annual, EU subs)  — Acme
//   - Rich entity_approvers per entity: a primary contact with role +
//     organization + country (the key demo piece — "CSP director in LU
//     + Head of Finance in Poland") plus a CC / CSP approver.
//   - For each entity, 1 declaration in `review` status so the user
//     can click through the whole workflow (approve → share → portal).
//   - For each declaration, 8-12 invoice_lines deliberately covering
//     every treatment code in the classifier (LUX_17/8/3/0, RC_EU_17,
//     RC_NONEU_17, AUTOLIV_17, EXEMPT_44, OUT_EU/NONEU, with FX lines).
//   - 3 AED communications (one per entity) — high/medium/low urgency.
//   - A handful of precedents so the classifier's "learned" badge
//     shows up.
//   - Synthetic api_calls rows so /metrics has data.
//
// Usage:
//   npm run seed:demo             # idempotent-ish: upserts by known ids
//   npm run seed:demo -- --reset  # wipes the demo rows first
//
// Safety: every row uses an id prefixed `demo-` so a reset only touches
// seeded data — never Diego's real records.
// ════════════════════════════════════════════════════════════════════════

import { query, execute, generateId } from '../src/lib/db';

const RESET = process.argv.includes('--reset');
const DEMO_PREFIX = 'demo-';

// ───────────────────────── demo clients ─────────────────────────
//
// A client groups one or more entities (the Avallon case). Each has a
// rich VAT contact at the group level — intentionally distinct from
// the per-entity approvers below, so the UI clearly distinguishes
// "group's main contact" from "this declaration's sign-off chain".

const CLIENTS = [
  {
    id: `${DEMO_PREFIX}client-acme`,
    name: 'Acme Capital Group',
    kind: 'end_client' as const,
    vat_contact_name: 'Jean-Marc Dubois',
    vat_contact_email: 'jmdubois@acmecapital.demo',
    vat_contact_phone: '+352 691 234 567',
    vat_contact_role: 'CFO',
    vat_contact_country: 'LU',
    address: '1, rue de la Liberté, L-1930 Luxembourg',
    website: 'acmecapital.demo',
    notes: 'Family office with a SOPARFI + a holding vehicle. Jean-Marc signs both.',
  },
  {
    id: `${DEMO_PREFIX}client-horizon`,
    name: 'Horizon Real Estate Group',
    kind: 'end_client' as const,
    vat_contact_name: 'Sofia Ricci',
    vat_contact_email: 'sricci@horizon-re.demo',
    vat_contact_phone: '+39 02 1234 5678',
    vat_contact_role: 'Head of Finance',
    vat_contact_country: 'IT',
    address: 'Via Monte Napoleone 8, 20121 Milano, Italy',
    website: 'horizon-re.demo',
    notes: 'Pan-EU RE AIFM. Sofia in Milan is the VAT point-person, but the CSP (Horizon AIFM LU) has to co-sign filings.',
  },
];

// ───────────────────────── demo entities ─────────────────────────

const ENTITIES = [
  {
    id: `${DEMO_PREFIX}ent-soparfi`,
    client_id: `${DEMO_PREFIX}client-acme`,
    name: 'Acme Capital SARL',
    vat_number: 'LU12345678',
    matricule: '20172456346',
    rcs_number: 'B212345',
    legal_form: 'SARL',
    entity_type: 'soparfi',
    regime: 'simplified' as const,
    frequency: 'annual' as const,
    address: '1, rue de la Liberté, L-1930 Luxembourg',
    client_name: 'Jean-Marc Dubois',
    client_email: 'jmdubois@acmecapital.demo',
    csp_name: 'MetaFund Services SA',
    csp_email: 'vat@metafund.demo',
    has_fx: false,
    has_outgoing: false,
    has_recharges: false,
    notes: 'Holding SOPARFI — dividends + limited intra-group services.',
  },
  {
    id: `${DEMO_PREFIX}ent-scsp`,
    client_id: `${DEMO_PREFIX}client-horizon`,
    name: 'Horizon Real Estate SCSp',
    vat_number: 'LU23456789',
    matricule: '20192999810',
    rcs_number: 'B245678',
    legal_form: 'SCSp',
    entity_type: 'aifm',
    regime: 'ordinary' as const,
    frequency: 'quarterly' as const,
    address: '2-4, avenue JF Kennedy, L-1855 Luxembourg',
    client_name: 'Sofia Ricci',
    client_email: 'sricci@horizon-re.demo',
    csp_name: 'Horizon AIFM Sàrl',
    csp_email: 'compliance@horizonaifm.demo',
    has_fx: true,
    has_outgoing: true,
    has_recharges: true,
    notes: 'Pan-EU real-estate AIFM, quarterly filings, multi-currency.',
  },
  {
    // Second entity under the same client as the SOPARFI — shows the
    // "one client, multiple entities" model on /clients/[id].
    id: `${DEMO_PREFIX}ent-hold`,
    client_id: `${DEMO_PREFIX}client-acme`,
    name: 'Zephyr Holdings SARL',
    vat_number: 'LU34567890',
    matricule: '20152123456',
    rcs_number: 'B198765',
    legal_form: 'SARL',
    entity_type: 'holding',
    regime: 'ordinary' as const,
    frequency: 'annual' as const,
    address: '15, boulevard Royal, L-2449 Luxembourg',
    client_name: 'Jean-Marc Dubois',
    client_email: 'jmdubois@acmecapital.demo',
    csp_name: 'Zephyr Group',
    csp_email: null,
    has_fx: true,
    has_outgoing: true,
    has_recharges: false,
    notes: 'Operating holding owned by Acme Capital Group — EU + non-EU subsidiaries.',
  },
];

// ───────────────────────── demo approvers ─────────────────────────
//
// Multi-approver per entity (Diego's "Avallon case" spec, 2026-04-18).
// Each row is one real person — name, email, role and country — so the
// UI can clearly render "who signs, in what capacity, in which country".

interface SeedApprover {
  id: string;
  entity_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  organization: string | null;
  country: string | null;
  approver_type: 'client' | 'csp' | 'internal' | 'other';
  is_primary: boolean;
  sort_order: number;
  notes: string | null;
}

const APPROVERS: SeedApprover[] = [
  // Acme SOPARFI — CFO at client + CSP admin
  {
    id: `${DEMO_PREFIX}app-soparfi-1`, entity_id: `${DEMO_PREFIX}ent-soparfi`,
    name: 'Jean-Marc Dubois', email: 'jmdubois@acmecapital.demo',
    phone: '+352 691 234 567', role: 'CFO', organization: 'Acme Capital Group',
    country: 'LU', approver_type: 'client', is_primary: true, sort_order: 1,
    notes: 'Primary sign-off — expect fast turnaround.',
  },
  {
    id: `${DEMO_PREFIX}app-soparfi-2`, entity_id: `${DEMO_PREFIX}ent-soparfi`,
    name: 'Maria Schneider', email: 'mschneider@metafund.demo',
    phone: '+352 27 12 34 56', role: 'VAT officer', organization: 'MetaFund Services SA',
    country: 'LU', approver_type: 'csp', is_primary: false, sort_order: 2,
    notes: 'CSP — needs to be CC-d on every filing.',
  },

  // Horizon SCSp — the headline case: Head of Finance in Italy + CSP director in LU
  {
    id: `${DEMO_PREFIX}app-scsp-1`, entity_id: `${DEMO_PREFIX}ent-scsp`,
    name: 'Sofia Ricci', email: 'sricci@horizon-re.demo',
    phone: '+39 02 1234 5678', role: 'Head of Finance', organization: 'Horizon Real Estate Group',
    country: 'IT', approver_type: 'client', is_primary: true, sort_order: 1,
    notes: 'Signs off on economics. Italian time zone.',
  },
  {
    id: `${DEMO_PREFIX}app-scsp-2`, entity_id: `${DEMO_PREFIX}ent-scsp`,
    name: 'Pieter van der Berg', email: 'pvdberg@horizonaifm.demo',
    phone: '+352 26 00 12 34', role: 'Compliance Director', organization: 'Horizon AIFM Sàrl',
    country: 'LU', approver_type: 'csp', is_primary: false, sort_order: 2,
    notes: 'CSP director — must co-sign on compliance grounds.',
  },

  // Zephyr — one approver (CFO Jean-Marc again) + a CC to the controller
  {
    id: `${DEMO_PREFIX}app-hold-1`, entity_id: `${DEMO_PREFIX}ent-hold`,
    name: 'Jean-Marc Dubois', email: 'jmdubois@acmecapital.demo',
    phone: '+352 691 234 567', role: 'CFO', organization: 'Acme Capital Group',
    country: 'LU', approver_type: 'client', is_primary: true, sort_order: 1,
    notes: 'Same person who signs Acme SOPARFI — group-level CFO.',
  },
  {
    id: `${DEMO_PREFIX}app-hold-2`, entity_id: `${DEMO_PREFIX}ent-hold`,
    name: 'Tomasz Kowalski', email: 'tkowalski@zephyr.demo',
    phone: '+48 22 555 12 34', role: 'Group Controller', organization: 'Zephyr Holdings SARL',
    country: 'PL', approver_type: 'internal', is_primary: false, sort_order: 2,
    notes: 'Controller based in Warsaw — needs English summaries, gets CC.',
  },
];

// ──────────────────────── demo invoice lines ────────────────────────

interface SeedLine {
  provider: string;
  country: string;
  direction: 'incoming' | 'outgoing';
  description: string;
  amount_eur: number;
  vat_rate: number;
  vat_applied: number;
  rc_amount: number;
  treatment: string;
  classification_rule: string;
  ai_confidence: number;
  currency?: string;
  currency_amount?: number;
  ecb_rate?: number;
}

// Each archetype gets a distinct mix so the three test declarations
// exercise different classifier branches.
const LINES_SOPARFI: SeedLine[] = [
  { provider: 'DocuFind Legal Sàrl', country: 'LU', direction: 'incoming',
    description: 'Legal fees — AGM preparation Q2',
    amount_eur: 850, vat_rate: 17, vat_applied: 144.50, rc_amount: 0,
    treatment: 'LUX_17', classification_rule: 'RULE 1', ai_confidence: 0.98 },
  { provider: 'PwC Luxembourg', country: 'LU', direction: 'incoming',
    description: 'Tax advisory retainer',
    amount_eur: 3200, vat_rate: 17, vat_applied: 544, rc_amount: 0,
    treatment: 'LUX_17', classification_rule: 'RULE 1', ai_confidence: 0.99 },
  { provider: 'Deutsche Börse', country: 'DE', direction: 'incoming',
    description: 'Market-data subscription — annual',
    amount_eur: 4800, vat_rate: 0, vat_applied: 0, rc_amount: 816,
    treatment: 'RC_EU_17', classification_rule: 'RULE 4', ai_confidence: 0.95 },
  { provider: 'LinkedIn Ireland', country: 'IE', direction: 'incoming',
    description: 'Recruiting services — board search',
    amount_eur: 1500, vat_rate: 0, vat_applied: 0, rc_amount: 255,
    treatment: 'RC_EU_17', classification_rule: 'RULE 4', ai_confidence: 0.96 },
  { provider: 'Legilux Abonnement', country: 'LU', direction: 'incoming',
    description: 'Official journal subscription',
    amount_eur: 120, vat_rate: 3, vat_applied: 3.60, rc_amount: 0,
    treatment: 'LUX_3', classification_rule: 'RULE 1', ai_confidence: 0.97 },
  { provider: 'POST Luxembourg', country: 'LU', direction: 'incoming',
    description: 'Registered mail + postal services',
    amount_eur: 210, vat_rate: 17, vat_applied: 35.70, rc_amount: 0,
    treatment: 'LUX_17', classification_rule: 'RULE 1', ai_confidence: 0.99 },
  { provider: 'HSBC Private Banking', country: 'LU', direction: 'incoming',
    description: 'Custody + account fees',
    amount_eur: 4500, vat_rate: 0, vat_applied: 0, rc_amount: 0,
    treatment: 'EXEMPT_44', classification_rule: 'RULE 2', ai_confidence: 0.99 },
  { provider: 'Notary Alex Schmitt', country: 'LU', direction: 'incoming',
    description: 'Share transfer notarisation',
    amount_eur: 2100, vat_rate: 17, vat_applied: 357, rc_amount: 0,
    treatment: 'LUX_17', classification_rule: 'RULE 1', ai_confidence: 0.98 },
];

const LINES_SCSP: SeedLine[] = [
  { provider: 'Horizon AIFM Sàrl', country: 'LU', direction: 'incoming',
    description: 'AIFM management fee — Q1 2026',
    amount_eur: 48000, vat_rate: 17, vat_applied: 8160, rc_amount: 0,
    treatment: 'LUX_17', classification_rule: 'RULE 1', ai_confidence: 0.99 },
  { provider: 'Bloomberg L.P.', country: 'US', direction: 'incoming',
    description: 'Terminal subscription — analyst',
    amount_eur: 5400, vat_rate: 0, vat_applied: 0, rc_amount: 918,
    treatment: 'RC_NONEU_17', classification_rule: 'RULE 5', ai_confidence: 0.93,
    currency: 'USD', currency_amount: 6156, ecb_rate: 1.14 },
  { provider: 'Knight Frank UK', country: 'GB', direction: 'incoming',
    description: 'Property valuation — London Portfolio',
    amount_eur: 7500, vat_rate: 0, vat_applied: 0, rc_amount: 1275,
    treatment: 'RC_NONEU_17', classification_rule: 'RULE 5', ai_confidence: 0.92,
    currency: 'GBP', currency_amount: 6420, ecb_rate: 0.856 },
  { provider: 'Allen & Overy LU', country: 'LU', direction: 'incoming',
    description: 'Legal — SPA review',
    amount_eur: 12500, vat_rate: 17, vat_applied: 2125, rc_amount: 0,
    treatment: 'LUX_17', classification_rule: 'RULE 1', ai_confidence: 0.99 },
  { provider: 'Bundesamt für Statistik', country: 'DE', direction: 'incoming',
    description: 'German real-estate market data',
    amount_eur: 2200, vat_rate: 0, vat_applied: 0, rc_amount: 374,
    treatment: 'RC_EU_17', classification_rule: 'RULE 4', ai_confidence: 0.94 },
  { provider: 'EY Luxembourg', country: 'LU', direction: 'incoming',
    description: 'Statutory audit — annual',
    amount_eur: 28500, vat_rate: 17, vat_applied: 4845, rc_amount: 0,
    treatment: 'LUX_17', classification_rule: 'RULE 1', ai_confidence: 0.99 },
  { provider: 'AWS EMEA SARL', country: 'LU', direction: 'incoming',
    description: 'Cloud infra — Q1',
    amount_eur: 3800, vat_rate: 17, vat_applied: 646, rc_amount: 0,
    treatment: 'LUX_17', classification_rule: 'RULE 1', ai_confidence: 0.98 },
  { provider: 'Real-Estate Fund Services SA', country: 'LU', direction: 'incoming',
    description: 'Fund admin services',
    amount_eur: 15000, vat_rate: 17, vat_applied: 2550, rc_amount: 0,
    treatment: 'LUX_17', classification_rule: 'RULE 1', ai_confidence: 0.99 },
  { provider: 'CIB Insurance', country: 'LU', direction: 'incoming',
    description: 'D&O insurance premium',
    amount_eur: 8200, vat_rate: 0, vat_applied: 0, rc_amount: 0,
    treatment: 'EXEMPT_44', classification_rule: 'RULE 2', ai_confidence: 0.98 },
  // Outgoing: management services billed to subsidiaries
  { provider: 'Horizon Italy SRL', country: 'IT', direction: 'outgoing',
    description: 'Asset-management fees Q1 2026',
    amount_eur: 45000, vat_rate: 0, vat_applied: 0, rc_amount: 0,
    treatment: 'OUT_EU', classification_rule: 'RULE 6', ai_confidence: 0.96 },
  { provider: 'Horizon France SARL', country: 'FR', direction: 'outgoing',
    description: 'Asset-management fees Q1 2026',
    amount_eur: 38500, vat_rate: 0, vat_applied: 0, rc_amount: 0,
    treatment: 'OUT_EU', classification_rule: 'RULE 6', ai_confidence: 0.96 },
];

const LINES_HOLD: SeedLine[] = [
  { provider: 'Arendt & Medernach', country: 'LU', direction: 'incoming',
    description: 'Legal fees — corporate restructuring',
    amount_eur: 18000, vat_rate: 17, vat_applied: 3060, rc_amount: 0,
    treatment: 'LUX_17', classification_rule: 'RULE 1', ai_confidence: 0.99 },
  { provider: 'KPMG Luxembourg', country: 'LU', direction: 'incoming',
    description: 'Audit + tax advisory',
    amount_eur: 24000, vat_rate: 17, vat_applied: 4080, rc_amount: 0,
    treatment: 'LUX_17', classification_rule: 'RULE 1', ai_confidence: 0.99 },
  { provider: 'Microsoft Ireland', country: 'IE', direction: 'incoming',
    description: 'Office 365 — annual subscription',
    amount_eur: 3400, vat_rate: 0, vat_applied: 0, rc_amount: 578,
    treatment: 'RC_EU_17', classification_rule: 'RULE 4', ai_confidence: 0.97 },
  { provider: 'DocuSign Inc.', country: 'US', direction: 'incoming',
    description: 'E-signature platform',
    amount_eur: 1800, vat_rate: 0, vat_applied: 0, rc_amount: 306,
    treatment: 'RC_NONEU_17', classification_rule: 'RULE 5', ai_confidence: 0.95,
    currency: 'USD', currency_amount: 2052, ecb_rate: 1.14 },
  { provider: 'Zephyr Asset Management', country: 'LU', direction: 'incoming',
    description: 'Intra-group service recharge',
    amount_eur: 12000, vat_rate: 17, vat_applied: 2040, rc_amount: 0,
    treatment: 'LUX_17', classification_rule: 'RULE 1', ai_confidence: 0.96 },
  // Autoliq — internal use
  { provider: 'Zephyr Holdings SARL', country: 'LU', direction: 'outgoing',
    description: 'Self-supply — private use of company asset',
    amount_eur: 1500, vat_rate: 0, vat_applied: 0, rc_amount: 0,
    treatment: 'AUTOLIV_17', classification_rule: 'RULE 31', ai_confidence: 0.88 },
  { provider: 'Banque Internationale à Luxembourg', country: 'LU', direction: 'incoming',
    description: 'Investment management fees',
    amount_eur: 6200, vat_rate: 0, vat_applied: 0, rc_amount: 0,
    treatment: 'EXEMPT_44', classification_rule: 'RULE 2', ai_confidence: 0.98 },
  { provider: 'LuxTrust SA', country: 'LU', direction: 'incoming',
    description: 'Electronic signature certificates',
    amount_eur: 220, vat_rate: 17, vat_applied: 37.40, rc_amount: 0,
    treatment: 'LUX_17', classification_rule: 'RULE 1', ai_confidence: 0.97 },
  // Outgoing to EU subsidiary
  { provider: 'Zephyr France SASU', country: 'FR', direction: 'outgoing',
    description: 'Management services Q1',
    amount_eur: 28000, vat_rate: 0, vat_applied: 0, rc_amount: 0,
    treatment: 'OUT_EU', classification_rule: 'RULE 6', ai_confidence: 0.97 },
  // Outgoing to non-EU subsidiary
  { provider: 'Zephyr UK Ltd', country: 'GB', direction: 'outgoing',
    description: 'Management services Q1',
    amount_eur: 18000, vat_rate: 0, vat_applied: 0, rc_amount: 0,
    treatment: 'OUT_NONEU', classification_rule: 'RULE 7', ai_confidence: 0.96 },
];

// ──────────────────────── AED letters ────────────────────────

interface SeedAedLetter {
  id: string;
  entity_id: string;
  filename: string;
  type: string;
  urgency: 'low' | 'medium' | 'high';
  status: string;
  summary: string;
  deadline_days_from_now: number;
  amount: number | null;
  reference: string;
}

function buildAedLetters(): SeedAedLetter[] {
  return [
    {
      id: `${DEMO_PREFIX}aed-1`, entity_id: `${DEMO_PREFIX}ent-soparfi`,
      filename: 'AED_payment_reminder_2025.pdf',
      type: 'payment_reminder', urgency: 'high', status: 'new',
      summary: 'Final reminder — VAT 2024 annual declaration, €1 247.60 due. Surcharge imposed.',
      deadline_days_from_now: 5,
      amount: 1247.60, reference: '20172456346 EA24Y1',
    },
    {
      id: `${DEMO_PREFIX}aed-2`, entity_id: `${DEMO_PREFIX}ent-scsp`,
      filename: 'AED_circular_ViDA_2026.pdf',
      type: 'circular', urgency: 'low', status: 'new',
      summary: 'Circular 815 — ViDA implementation schedule for LU taxpayers.',
      deadline_days_from_now: 90,
      amount: null, reference: 'C-815/2026',
    },
    {
      id: `${DEMO_PREFIX}aed-3`, entity_id: `${DEMO_PREFIX}ent-hold`,
      filename: 'AED_audit_request_Q4.pdf',
      type: 'audit_request', urgency: 'medium', status: 'new',
      summary: 'Request for supporting documentation — Q4 2025 EU B2B services (RC).',
      deadline_days_from_now: 14,
      amount: null, reference: 'AR-2026/1123',
    },
  ];
}

// ─────────────────── precedents ───────────────────

const PRECEDENTS = [
  { entity_id: `${DEMO_PREFIX}ent-soparfi`, provider: 'PwC Luxembourg',   country: 'LU', treatment: 'LUX_17',   times_used: 6 },
  { entity_id: `${DEMO_PREFIX}ent-soparfi`, provider: 'HSBC Private Banking', country: 'LU', treatment: 'EXEMPT_44', times_used: 4 },
  { entity_id: `${DEMO_PREFIX}ent-scsp`,    provider: 'EY Luxembourg',    country: 'LU', treatment: 'LUX_17',    times_used: 3 },
  { entity_id: `${DEMO_PREFIX}ent-scsp`,    provider: 'Bloomberg L.P.',   country: 'US', treatment: 'RC_NONEU_17', times_used: 2 },
  { entity_id: `${DEMO_PREFIX}ent-hold`,    provider: 'KPMG Luxembourg',  country: 'LU', treatment: 'LUX_17',    times_used: 5 },
];

// ─────────────────────────── helpers ───────────────────────────

function addDays(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

async function wipeDemo(): Promise<void> {
  console.log('🧹  Wiping existing demo rows (prefix: demo-)...');
  // Order matters — children first to avoid FK violations.
  const tables = [
    'invoice_lines', 'invoices', 'aed_communications', 'precedents',
    'entity_approvers', 'declarations', 'entities', 'clients',
  ];
  for (const t of tables) {
    await execute(`DELETE FROM ${t} WHERE id LIKE $1 OR (CASE WHEN '${t}' = 'invoice_lines' OR '${t}' = 'invoices' THEN declaration_id LIKE $1 ELSE FALSE END)`, [`${DEMO_PREFIX}%`]);
  }
  // Clean api_calls rows tagged with demo label
  try {
    await execute(`DELETE FROM api_calls WHERE label LIKE 'demo %'`);
  } catch { /* best-effort */ }
  console.log('   …done.');
}

async function seedClient(c: typeof CLIENTS[number]): Promise<void> {
  await execute(
    `INSERT INTO clients (id, name, kind, vat_contact_name, vat_contact_email,
        vat_contact_phone, vat_contact_role, vat_contact_country,
        address, website, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       kind = EXCLUDED.kind,
       vat_contact_name = EXCLUDED.vat_contact_name,
       vat_contact_email = EXCLUDED.vat_contact_email,
       vat_contact_phone = EXCLUDED.vat_contact_phone,
       vat_contact_role = EXCLUDED.vat_contact_role,
       vat_contact_country = EXCLUDED.vat_contact_country,
       address = EXCLUDED.address,
       website = EXCLUDED.website,
       notes = EXCLUDED.notes,
       updated_at = NOW()`,
    [
      c.id, c.name, c.kind,
      c.vat_contact_name, c.vat_contact_email, c.vat_contact_phone,
      c.vat_contact_role, c.vat_contact_country,
      c.address, c.website, c.notes,
    ],
  );
  console.log(`   ✓ Client ${c.name}`);
}

async function seedApprover(a: SeedApprover): Promise<void> {
  await execute(
    `INSERT INTO entity_approvers (id, entity_id, name, email, phone, role,
        organization, country, approver_type, is_primary, sort_order, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       email = EXCLUDED.email,
       phone = EXCLUDED.phone,
       role = EXCLUDED.role,
       organization = EXCLUDED.organization,
       country = EXCLUDED.country,
       approver_type = EXCLUDED.approver_type,
       is_primary = EXCLUDED.is_primary,
       sort_order = EXCLUDED.sort_order,
       notes = EXCLUDED.notes,
       updated_at = NOW()`,
    [
      a.id, a.entity_id, a.name, a.email, a.phone, a.role,
      a.organization, a.country, a.approver_type,
      a.is_primary, a.sort_order, a.notes,
    ],
  );
}

async function seedEntity(e: typeof ENTITIES[number]): Promise<void> {
  await execute(
    `INSERT INTO entities (id, client_id, name, vat_number, matricule, rcs_number, legal_form,
        entity_type, regime, frequency, address, client_name, client_email,
        csp_name, csp_email, has_fx, has_outgoing, has_recharges, notes, vat_status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,'registered')
     ON CONFLICT (id) DO UPDATE SET
       client_id = EXCLUDED.client_id,
       name = EXCLUDED.name,
       vat_number = EXCLUDED.vat_number,
       matricule = EXCLUDED.matricule,
       regime = EXCLUDED.regime,
       frequency = EXCLUDED.frequency,
       updated_at = NOW()`,
    [
      e.id, e.client_id, e.name, e.vat_number, e.matricule, e.rcs_number, e.legal_form,
      e.entity_type, e.regime, e.frequency, e.address,
      e.client_name, e.client_email, e.csp_name, e.csp_email,
      e.has_fx, e.has_outgoing, e.has_recharges, e.notes,
    ],
  );
  console.log(`   ✓ Entity ${e.name}`);
}

async function seedDeclarationAndLines(
  entityId: string,
  year: number,
  period: string,
  lines: SeedLine[],
): Promise<string> {
  const declId = `${DEMO_PREFIX}decl-${entityId.replace(DEMO_PREFIX, '')}-${year}-${period}`;

  await execute(
    `INSERT INTO declarations (id, entity_id, year, period, status, notes)
     VALUES ($1, $2, $3, $4, 'review', 'Demo declaration — classifier output sample')
     ON CONFLICT (id) DO UPDATE SET
       status = 'review',
       updated_at = NOW()`,
    [declId, entityId, year, period],
  );

  // Group lines by provider (one invoice per provider-group so the UI
  // shows grouped invoices like the extractor produces).
  const groups = new Map<string, SeedLine[]>();
  for (const line of lines) {
    const key = `${line.provider}__${line.country}__${line.direction}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(line);
  }

  let sortOrder = 0;
  const today = new Date();
  const baseDate = new Date(year, Number(period.replace(/[^0-9]/g, '') || 1) * 3 - 3, 15);

  for (const [key, grp] of groups) {
    const [provider, country, direction] = key.split('__');
    const invoiceId = `${DEMO_PREFIX}inv-${generateId().slice(0, 8)}`;
    const invoiceDate = addDays(baseDate, Math.floor(Math.random() * 60));
    const first = grp[0]!;

    await execute(
      `INSERT INTO invoices (id, document_id, declaration_id, provider, country,
          direction, invoice_date, invoice_number, currency, currency_amount,
          ecb_rate, extraction_source)
       VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'demo_seed')`,
      [
        invoiceId, declId, provider!, country!, direction!,
        invoiceDate,
        `INV-${Math.floor(Math.random() * 90000 + 10000)}`,
        first.currency || null,
        first.currency_amount || null,
        first.ecb_rate || null,
      ],
    );

    for (const line of grp) {
      sortOrder += 1;
      const lineId = `${DEMO_PREFIX}line-${generateId().slice(0, 8)}`;
      const amount_incl = line.amount_eur + line.vat_applied;
      await execute(
        `INSERT INTO invoice_lines (id, invoice_id, declaration_id, description,
            amount_eur, vat_rate, vat_applied, rc_amount, amount_incl,
            treatment, treatment_source, classification_rule, ai_confidence,
            sort_order, state)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'classifier', $11, $12, $13, 'classified')`,
        [
          lineId, invoiceId, declId, line.description,
          line.amount_eur, line.vat_rate, line.vat_applied, line.rc_amount,
          amount_incl,
          line.treatment, line.classification_rule, line.ai_confidence,
          sortOrder,
        ],
      );
    }
  }
  // Recent touch so sort order on the declarations page puts it first.
  await execute(
    `UPDATE declarations SET updated_at = $1 WHERE id = $2`,
    [today.toISOString(), declId],
  );
  return declId;
}

async function seedAedLetter(letter: SeedAedLetter): Promise<void> {
  const today = new Date();
  // Real table is aed_communications (aed_letters is only a UI-layer
  // variable name). Status enum: received / reviewed / actioned / archived.
  const status = letter.status === 'new' ? 'received' : letter.status;
  await execute(
    `INSERT INTO aed_communications (id, entity_id, filename, file_path, file_size,
        type, urgency, status, summary, reference, amount, deadline_date,
        uploaded_at)
     VALUES ($1, $2, $3, $4, 0, $5, $6, $7, $8, $9, $10, $11, $12)
     ON CONFLICT (id) DO UPDATE SET
       summary = EXCLUDED.summary,
       status = EXCLUDED.status,
       urgency = EXCLUDED.urgency,
       updated_at = NOW()`,
    [
      letter.id, letter.entity_id, letter.filename, `demo/${letter.filename}`,
      letter.type, letter.urgency, status, letter.summary,
      letter.reference, letter.amount,
      addDays(today, letter.deadline_days_from_now),
      today.toISOString(),
    ],
  );
  console.log(`   ✓ AED communication ${letter.reference}`);
}

async function seedPrecedents(): Promise<void> {
  for (const p of PRECEDENTS) {
    const id = `${DEMO_PREFIX}prec-${p.provider.slice(0, 6).replace(/\W/g, '')}-${p.country}`;
    await execute(
      `INSERT INTO precedents (id, entity_id, provider, country, treatment,
          last_used, times_used)
       VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, $6)
       ON CONFLICT (entity_id, provider, country) DO UPDATE SET
         treatment = EXCLUDED.treatment,
         times_used = EXCLUDED.times_used,
         last_used = EXCLUDED.last_used`,
      [id, p.entity_id, p.provider, p.country, p.treatment, p.times_used],
    );
  }
  console.log(`   ✓ ${PRECEDENTS.length} precedents`);
}

async function seedApiCallSamples(): Promise<void> {
  // Populate /metrics with a realistic cost-by-agent distribution.
  const today = new Date();
  const rows: Array<{ agent: string; model: string; cost: number; in: number; out: number }> = [];

  // Last 14 days of activity
  for (let day = 0; day < 14; day++) {
    rows.push(
      { agent: 'extractor', model: 'claude-haiku-4-5-20251001', cost: 0.08 + Math.random() * 0.12, in: 8000, out: 2000 },
      { agent: 'triage',    model: 'claude-haiku-4-5-20251001', cost: 0.02 + Math.random() * 0.03, in: 2500, out: 300 },
    );
    if (day % 3 === 0) {
      rows.push({ agent: 'validator', model: 'claude-opus-4-5-20250929', cost: 0.40 + Math.random() * 0.6, in: 6000, out: 2500 });
    }
    if (day % 5 === 0) {
      rows.push({ agent: 'chat-haiku', model: 'claude-haiku-4-5-20251001', cost: 0.03 + Math.random() * 0.05, in: 3000, out: 1000 });
    }
  }

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]!;
    const createdAt = new Date(today);
    createdAt.setDate(createdAt.getDate() - Math.floor(i / 3));
    const id = `${DEMO_PREFIX}call-${generateId().slice(0, 8)}`;
    try {
      await execute(
        `INSERT INTO api_calls (id, agent, model, input_tokens, output_tokens,
            cost_eur, duration_ms, status, label, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'ok', 'demo seed sample', $8)`,
        [id, r.agent, r.model, r.in, r.out, r.cost, 1200 + Math.floor(Math.random() * 3000), createdAt.toISOString()],
      );
    } catch {
      // api_calls schema may differ or column be missing — best-effort
    }
  }
  console.log(`   ✓ ${rows.length} api_calls samples`);
}

// ─────────────────────────── main ───────────────────────────

async function main() {
  console.log('\n🌱  cifra demo seeder');
  console.log('   DB target: ' + (process.env.DATABASE_URL?.replace(/:[^@]+@/, ':***@') ?? '(sqlite fallback)'));
  console.log('');

  if (RESET) {
    await wipeDemo();
  }

  console.log('🏢  Seeding clients...');
  for (const c of CLIENTS) await seedClient(c);

  console.log('\n👥  Seeding entities...');
  for (const e of ENTITIES) await seedEntity(e);

  console.log('\n✍️  Seeding approvers...');
  for (const a of APPROVERS) await seedApprover(a);
  console.log(`   ✓ ${APPROVERS.length} approvers across ${ENTITIES.length} entities`);

  console.log('\n📄  Seeding declarations + invoices + lines...');
  // SOPARFI — annual 2024 Y1
  const d1 = await seedDeclarationAndLines(`${DEMO_PREFIX}ent-soparfi`, 2024, 'Y1', LINES_SOPARFI);
  console.log(`   ✓ Acme Capital 2024 Y1 → ${LINES_SOPARFI.length} lines (decl ${d1})`);

  // SCSp — quarterly 2026 Q1
  const d2 = await seedDeclarationAndLines(`${DEMO_PREFIX}ent-scsp`, 2026, 'Q1', LINES_SCSP);
  console.log(`   ✓ Horizon SCSp 2026 Q1 → ${LINES_SCSP.length} lines (decl ${d2})`);

  // Holding — annual 2025 Y1
  const d3 = await seedDeclarationAndLines(`${DEMO_PREFIX}ent-hold`, 2025, 'Y1', LINES_HOLD);
  console.log(`   ✓ Zephyr Holdings 2025 Y1 → ${LINES_HOLD.length} lines (decl ${d3})`);

  console.log('\n📬  Seeding AED letters...');
  for (const l of buildAedLetters()) await seedAedLetter(l);

  console.log('\n🧠  Seeding precedents...');
  await seedPrecedents();

  console.log('\n💸  Seeding API-call samples for /metrics...');
  await seedApiCallSamples();

  // Summary
  const counts = await query<{
    clients: string; entities: string; approvers: string;
    decls: string; invoices: string; lines: string; aed: string;
  }>(
    `SELECT
       (SELECT COUNT(*)::text FROM clients WHERE id LIKE $1) AS clients,
       (SELECT COUNT(*)::text FROM entities WHERE id LIKE $1) AS entities,
       (SELECT COUNT(*)::text FROM entity_approvers WHERE id LIKE $1) AS approvers,
       (SELECT COUNT(*)::text FROM declarations WHERE id LIKE $1) AS decls,
       (SELECT COUNT(*)::text FROM invoices WHERE id LIKE $1) AS invoices,
       (SELECT COUNT(*)::text FROM invoice_lines WHERE id LIKE $1) AS lines,
       (SELECT COUNT(*)::text FROM aed_communications WHERE id LIKE $1) AS aed`,
    [`${DEMO_PREFIX}%`],
  );

  console.log('\n✅  Done.');
  console.log(`   clients:          ${counts[0]?.clients}`);
  console.log(`   entities:         ${counts[0]?.entities}`);
  console.log(`   approvers:        ${counts[0]?.approvers}`);
  console.log(`   declarations:     ${counts[0]?.decls}`);
  console.log(`   invoices:         ${counts[0]?.invoices}`);
  console.log(`   lines:            ${counts[0]?.lines}`);
  console.log(`   aed communications: ${counts[0]?.aed}`);
  console.log('\n  Now run:  npm run dev   then open http://localhost:3000');
  console.log('  To clear the demo data:  npm run seed:demo -- --reset\n');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌  Seeder failed:\n', err);
    process.exit(1);
  });
