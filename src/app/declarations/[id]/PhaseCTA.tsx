'use client';

// ════════════════════════════════════════════════════════════════════════
// PhaseCTA — the "what do I click next?" button.
//
// Diego's 2026-04-22 critique boiled down to: the UI has five tabs but
// no single sticky CTA telling the reviewer the next action. This
// component exposes exactly one primary button per phase, with back /
// tertiary affordances where useful. It's the wizard skeleton layered
// on top of the existing 5-tab layout.
//
// Principle (PROTOCOLS §11): every button MUST move the declaration
// forward. No vanity buttons. If the phase has no meaningful action
// (e.g. extracting / classifying in flight), render the job progress
// pill instead — NOT a disabled button.
// ════════════════════════════════════════════════════════════════════════

import { ArrowRightIcon, ArrowLeftIcon, UploadCloudIcon, CheckCircle2Icon, Loader2Icon,
  FileTextIcon, SendIcon } from 'lucide-react';

export type PhaseCTAStatus =
  | 'created' | 'uploading' | 'extracting' | 'classifying'
  | 'review' | 'pending_review' | 'approved' | 'filed' | 'paid';

export interface PhaseCTAProps {
  status: PhaseCTAStatus;
  /** Blocks that must clear before Approve can fire (unclassified lines,
   *  unacknowledged flags). When > 0, Approve is disabled with tooltip. */
  blockers: { unclassified: number; flagged: number };
  /** Whether the entity is flagged requires_partner_review. When true,
   *  the CTA in 'review' reads "Submit for partner review" instead of
   *  "Approve". (Plumbed through migration 023 in a follow-up commit;
   *  default false for backward compat.) */
  requiresPartnerReview?: boolean;
  /** When status is pending_review: true = the current user is the one
   *  who submitted, so they cannot self-approve. false = partner, can
   *  approve. */
  viewerIsSubmitter?: boolean;
  /** Documents uploaded but not yet extracted — shows "Extract all" CTA. */
  hasPendingDocs: boolean;
  /** An agent run is actively in flight (job polling). Show progress,
   *  hide the CTA button. */
  jobRunning: boolean;
  /** Count of extracted invoice lines — drives the review-tab CTA's
   *  secondary label ("3 lines classified — review them"). */
  activeLineCount: number;

  // Actions — the parent handles state + tab switching + API calls.
  onGoToDocuments: () => void;
  onExtractAll: () => void;
  onGoToSummary: () => void;
  onApprove: () => void;
  onSubmitForReview: () => void;
  onPartnerApprove: () => void;
  onGoToFiling: () => void;
  /** When set, render a muted "← Reopen" tertiary button alongside the
   *  primary CTA for forward states (approved / filed / paid /
   *  pending_review). The parent handles the confirmation modal + PATCH
   *  back to 'review'. Omit for states where there's nothing to reopen
   *  from (created / uploading / review). */
  onReopen?: () => void;
}

export function PhaseCTA(p: PhaseCTAProps) {
  const blockingCount = p.blockers.unclassified + p.blockers.flagged;
  const blockerTooltip = blockingCount > 0
    ? `${p.blockers.unclassified} unclassified, ${p.blockers.flagged} flag${p.blockers.flagged === 1 ? '' : 's'} pending — resolve before continuing.`
    : undefined;

  // In-flight agent runs: render a progress pill, no button.
  if (p.jobRunning || p.status === 'extracting' || p.status === 'classifying') {
    const label = p.status === 'extracting' ? 'Extracting invoice fields…'
      : p.status === 'classifying' ? 'Classifying lines with rules…'
      : 'Processing…';
    return (
      <div className="inline-flex items-center gap-2 h-9 px-4 rounded-md border border-violet-200 bg-violet-50 text-violet-800 text-sm font-medium">
        <Loader2Icon size={14} className="animate-spin" />
        {label}
      </div>
    );
  }

  // created / uploading with no docs → go to Documents tab + upload.
  if (p.status === 'created' || (p.status === 'uploading' && !p.hasPendingDocs)) {
    return (
      <PrimaryButton onClick={p.onGoToDocuments} icon={<UploadCloudIcon size={14} />}>
        Upload invoices
      </PrimaryButton>
    );
  }

  // Docs uploaded, not extracted yet → big "Extract all" CTA.
  // (status === 'created' was handled above, so only 'uploading' reaches here.)
  if (p.hasPendingDocs && p.status === 'uploading') {
    return (
      <PrimaryButton onClick={p.onExtractAll} icon={<ArrowRightIcon size={14} />}>
        Extract all
      </PrimaryButton>
    );
  }

  // Review → move to Summary.
  if (p.status === 'review') {
    return (
      <PrimaryButton
        onClick={p.onGoToSummary}
        icon={<ArrowRightIcon size={14} />}
        subtitle={
          p.activeLineCount > 0
            ? `${p.activeLineCount} line${p.activeLineCount === 1 ? '' : 's'} classified`
            : undefined
        }
      >
        Continue to summary
      </PrimaryButton>
    );
  }

  // From Summary (approved=false yet): Approve OR Submit for partner review.
  // This is signalled by the parent setting status='review' and the UI
  // being on the summary tab; here we can't distinguish so we key on
  // hasPendingDocs=false + activeLineCount>0 + status='review' — already
  // handled above. The Summary-tab CTA is therefore rendered by the parent
  // with a separate <PhaseCTA status="review"> variant. For the true
  // "on summary, ready to approve" state, the parent passes status='review'
  // still but a separate prop; to keep the API simple the parent just
  // swaps which CTA it renders. Future commits may introduce a proper
  // 'summary_confirmed' synthetic status.
  //
  // For now, approved / filed / paid are handled below.

  // pending_review (partner review flow) — migration 023 lights this up.
  if (p.status === 'pending_review') {
    if (p.viewerIsSubmitter) {
      return (
        <CTAGroup onReopen={p.onReopen} reopenLabel="Recall submission">
          <div className="inline-flex items-center gap-2 h-9 px-4 rounded-md border border-amber-200 bg-amber-50 text-amber-900 text-sm font-medium">
            <SendIcon size={14} />
            Submitted — awaiting partner review
          </div>
        </CTAGroup>
      );
    }
    return (
      <CTAGroup onReopen={p.onReopen}>
        <PrimaryButton
          onClick={p.onPartnerApprove}
          icon={<CheckCircle2Icon size={14} />}
          disabled={blockingCount > 0}
          tooltip={blockerTooltip}
        >
          Approve as partner
        </PrimaryButton>
      </CTAGroup>
    );
  }

  // approved → file.
  if (p.status === 'approved') {
    return (
      <CTAGroup onReopen={p.onReopen}>
        <PrimaryButton onClick={p.onGoToFiling} icon={<FileTextIcon size={14} />}>
          Record filing reference
        </PrimaryButton>
      </CTAGroup>
    );
  }

  // filed → mark as paid.
  if (p.status === 'filed') {
    return (
      <CTAGroup onReopen={p.onReopen} reopenLabel="Un-file &amp; reopen">
        <PrimaryButton onClick={p.onGoToFiling} icon={<CheckCircle2Icon size={14} />}>
          Mark as paid
        </PrimaryButton>
      </CTAGroup>
    );
  }

  // paid → cycle complete; no CTA.
  if (p.status === 'paid') {
    return (
      <CTAGroup onReopen={p.onReopen} reopenLabel="Un-file &amp; reopen">
        <div className="inline-flex items-center gap-2 h-9 px-4 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-900 text-sm font-medium">
          <CheckCircle2Icon size={14} />
          Cycle complete
        </div>
      </CTAGroup>
    );
  }

  return null;
}

// ────────────────────────────────────────────────────────────────────
// CTAGroup — wraps the phase's primary CTA with an optional muted
// "← Reopen" tertiary button. When onReopen is omitted, the wrapper
// collapses to just children (backward compatible with pre-Slice-B
// rendering). Keeps visual weight on the primary action while still
// giving Diego a one-click escape from a forward state.
// ────────────────────────────────────────────────────────────────────
function CTAGroup({
  children, onReopen, reopenLabel,
}: {
  children: React.ReactNode;
  onReopen?: () => void;
  reopenLabel?: string;
}) {
  if (!onReopen) return <>{children}</>;
  return (
    <div className="inline-flex items-center gap-2">
      {children}
      <button
        onClick={onReopen}
        className="inline-flex items-center gap-1 h-9 px-3 rounded-md text-slate-600 hover:bg-slate-100 text-sm font-medium transition-colors"
        title="Reopen this declaration — status returns to Review and lines become editable."
      >
        <ArrowLeftIcon size={14} />
        {reopenLabel ?? 'Reopen'}
      </button>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Variant rendered on the Summary tab: primary Approve button, or
// "Submit for partner review" when the entity requires it. The parent
// chooses which to render based on which tab is active.
// ────────────────────────────────────────────────────────────────────
export function SummaryApproveCTA(p: {
  blockers: { unclassified: number; flagged: number };
  requiresPartnerReview: boolean;
  onApprove: () => void;
  onSubmitForReview: () => void;
}) {
  const blockingCount = p.blockers.unclassified + p.blockers.flagged;
  const tooltip = blockingCount > 0
    ? `${p.blockers.unclassified} unclassified, ${p.blockers.flagged} flag${p.blockers.flagged === 1 ? '' : 's'} pending — resolve on the Review tab first.`
    : undefined;

  if (p.requiresPartnerReview) {
    return (
      <PrimaryButton
        onClick={p.onSubmitForReview}
        icon={<SendIcon size={14} />}
        disabled={blockingCount > 0}
        tooltip={tooltip}
      >
        Submit for partner review
      </PrimaryButton>
    );
  }
  return (
    <PrimaryButton
      onClick={p.onApprove}
      icon={<CheckCircle2Icon size={14} />}
      disabled={blockingCount > 0}
      tooltip={tooltip}
    >
      Approve
    </PrimaryButton>
  );
}

// ────────────────────────────────────────────────────────────────────
// Shared button atom — keeps the styling coherent across all phases.
// ────────────────────────────────────────────────────────────────────
function PrimaryButton({
  onClick, icon, children, subtitle, disabled, tooltip,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
  subtitle?: string;
  disabled?: boolean;
  tooltip?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={tooltip}
      className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {icon}
      <span className="flex flex-col items-start leading-tight">
        <span>{children}</span>
        {subtitle && <span className="text-2xs opacity-90 font-normal">{subtitle}</span>}
      </span>
    </button>
  );
}
