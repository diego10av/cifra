// Shared TypeScript types for the CRM module (stint 25).
//
// The DB uses snake_case everywhere; UI displays labels from
// LABELS_* dictionaries. Emojis live only in render-layer helpers,
// never in DB values — keeps SQL/Excel exports clean.

export const COMPANY_CLASSIFICATIONS = ['key_account', 'standard', 'occasional', 'not_yet_client'] as const;
export type CompanyClassification = typeof COMPANY_CLASSIFICATIONS[number];

export const COMPANY_INDUSTRIES = [
  'family_office', 'service_provider', 'law_firm', 'private_wealth',
  'real_estate', 'banking', 'private_equity', 'other',
] as const;
export type CompanyIndustry = typeof COMPANY_INDUSTRIES[number];

export const COMPANY_SIZES = ['large_cap', 'mid_market', 'sme', 'startup'] as const;
export type CompanySize = typeof COMPANY_SIZES[number];

export const OPPORTUNITY_STAGES = [
  'lead_identified', 'initial_contact', 'meeting_held',
  'proposal_sent', 'in_negotiation', 'won', 'lost',
] as const;
export type OpportunityStage = typeof OPPORTUNITY_STAGES[number];

export const MATTER_STATUSES = ['active', 'on_hold', 'closed', 'archived'] as const;
export type MatterStatus = typeof MATTER_STATUSES[number];

export const INVOICE_STATUSES = [
  'draft', 'sent', 'paid', 'partially_paid', 'overdue', 'cancelled', 'credit_note',
] as const;
export type InvoiceStatus = typeof INVOICE_STATUSES[number];

export const ACTIVITY_TYPES = [
  'call', 'meeting', 'email', 'proposal', 'hearing', 'deadline', 'other',
] as const;
export type ActivityType = typeof ACTIVITY_TYPES[number];

export const CONTACT_LIFECYCLES = ['lead', 'prospect', 'customer', 'former_customer'] as const;
export type ContactLifecycle = typeof CONTACT_LIFECYCLES[number];

export const ENGAGEMENT_LEVELS = ['active', 'dormant', 'lapsed'] as const;
export type EngagementLevel = typeof ENGAGEMENT_LEVELS[number];

export const TASK_STATUSES = ['open', 'in_progress', 'done', 'snoozed', 'cancelled'] as const;
export type TaskStatus = typeof TASK_STATUSES[number];

export const TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export type TaskPriority = typeof TASK_PRIORITIES[number];

// ────────── Display labels (emoji + human-readable) ──────────

export const LABELS_CLASSIFICATION: Record<CompanyClassification, string> = {
  key_account:    '🔑 Key Account',
  standard:       '⭐ Standard',
  occasional:     '🔁 Occasional',
  not_yet_client: 'Not a client yet',
};

export const LABELS_INDUSTRY: Record<CompanyIndustry, string> = {
  family_office:    'Family Office',
  service_provider: 'Service Provider',
  law_firm:         'Law Firm',
  private_wealth:   'Private Wealth',
  real_estate:      'Real Estate',
  banking:          'Banking',
  private_equity:   'Private Equity',
  other:            'Other',
};

export const LABELS_SIZE: Record<CompanySize, string> = {
  large_cap:  'Large cap',
  mid_market: 'Mid-market',
  sme:        'SME',
  startup:    'Start-up',
};

export const LABELS_STAGE: Record<OpportunityStage, string> = {
  lead_identified: '🔵 Lead identified',
  initial_contact: '🟡 Initial contact',
  meeting_held:    '🟠 Meeting held',
  proposal_sent:   '🔴 Proposal sent',
  in_negotiation:  '🟣 In negotiation',
  won:             '✅ Won',
  lost:            '❌ Lost',
};

export const LABELS_MATTER_STATUS: Record<MatterStatus, string> = {
  active:   '🟢 Active',
  on_hold:  '🟡 On hold',
  closed:   '✅ Closed',
  archived: '🗃️ Archived',
};

export const LABELS_INVOICE_STATUS: Record<InvoiceStatus, string> = {
  draft:          '📝 Draft',
  sent:           '📤 Sent',
  paid:           '✅ Paid',
  partially_paid: '🟡 Partially paid',
  overdue:        '🔴 Overdue',
  cancelled:      '⚪ Cancelled',
  credit_note:    '↩️ Credit note',
};

export const LABELS_ACTIVITY_TYPE: Record<ActivityType, string> = {
  call:     '📞 Call',
  meeting:  '🤝 Meeting',
  email:    '📧 Email',
  proposal: '📄 Proposal',
  hearing:  '⚖️ Hearing',
  deadline: '⏰ Deadline',
  other:    '📝 Other',
};

export const LABELS_LIFECYCLE: Record<ContactLifecycle, string> = {
  lead:            'Lead',
  prospect:        'Prospect',
  customer:        'Customer',
  former_customer: 'Former customer',
};

export const LABELS_ENGAGEMENT: Record<EngagementLevel, string> = {
  active:  '🟢 Active',
  dormant: '🟡 Dormant',
  lapsed:  '🔴 Lapsed',
};

export const LABELS_TASK_STATUS: Record<TaskStatus, string> = {
  open:        '◯ Open',
  in_progress: '◉ In progress',
  done:        '✓ Done',
  snoozed:     '⏸ Snoozed',
  cancelled:   '✗ Cancelled',
};

export const LABELS_TASK_PRIORITY: Record<TaskPriority, string> = {
  urgent: '🔥 Urgent',
  high:   '⬆ High',
  medium: '● Medium',
  low:    '⬇ Low',
};

export function formatEur(n: number | string | null | undefined): string {
  if (n === null || n === undefined) return '—';
  const num = typeof n === 'string' ? parseFloat(n) : n;
  if (Number.isNaN(num)) return '—';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toISOString().slice(0, 10);
}
