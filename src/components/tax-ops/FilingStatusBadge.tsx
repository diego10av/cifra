'use client';

// Small status chip for tax filings. Colors chosen to be legible at a
// glance in grid rows — not decorative.
//
// Status enum rework (stint 37.A):
//   - pending_info → info_to_request (we ask first, not wait passively)
//   - pending_client_approval merged into draft_sent
//   - awaiting_client_clarification: new — we emailed client for a
//     specific clarification, waiting on their reply
//   - paid removed from enum — paid_at / amount_paid live as separate
//     optional fields on the filing, not as workflow state

const STATUS_META: Record<string, { label: string; tone: string }> = {
  info_to_request:              { label: 'Info to request',         tone: 'bg-surface-alt text-ink-muted' },
  info_received:                { label: 'Info received',           tone: 'bg-blue-100 text-blue-800' },
  working:                      { label: 'Working',                 tone: 'bg-amber-100 text-amber-800' },
  awaiting_client_clarification:{ label: 'Awaiting client clarif.', tone: 'bg-amber-100 text-amber-900' },
  draft_sent:                   { label: 'Draft sent',              tone: 'bg-brand-100 text-brand-800' },
  filed:                        { label: 'Filed',                   tone: 'bg-green-100 text-green-800' },
  assessment_received:          { label: 'Assessment received',     tone: 'bg-green-200 text-green-900' },
  waived:                       { label: 'Waived',                  tone: 'bg-surface-alt text-ink-muted' },
  blocked:                      { label: 'Blocked',                 tone: 'bg-danger-100 text-danger-800' },
};

/** Order reflects workflow progression — used by list selectors so the
 *  most-common next-step status appears first in the dropdown. */
export const FILING_STATUSES = [
  'info_to_request',
  'info_received',
  'working',
  'awaiting_client_clarification',
  'draft_sent',
  'filed',
  'assessment_received',
  'blocked',
  'waived',
];

export function FilingStatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, tone: 'bg-surface-alt text-ink-muted' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${meta.tone}`}>
      {meta.label}
    </span>
  );
}

export function filingStatusLabel(status: string): string {
  return STATUS_META[status]?.label ?? status;
}
