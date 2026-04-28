// ════════════════════════════════════════════════════════════════════════
// Follow-up signal — stint 64.K
//
// Diego: "como sé si tengo que hacer follow up o algo. puedo poner
// fechas, alertas, lo mismo para el NWT provision. como hacer
// seguimiento del estado sin que se me pase nada?"
//
// Computes a "you should follow up" signal for any cell whose status
// is currently "waiting on the client". The signal goes:
//
//     0–6 days → no chip (fresh, no nag)
//     7–13 days → amber chip "⏰ Nd" with "consider following up"
//     14+ days → red chip "⏰ Nd" with "stuck — likely dropped"
//
// Used by TaxProvisionInlineCell + NwtReviewInlineCell. Centralised
// here because the same logic will fan out to the CIT main filing
// (info_requested, draft_sent, etc.) once the pattern proves out.
// ════════════════════════════════════════════════════════════════════════

export interface FollowUpSignal {
  /** Days since last_action_at, integer ≥ 0; null when the cell is not
   *  waiting on the client or has no action timestamp yet. */
  days: number | null;
  tone: 'none' | 'amber' | 'red';
  message: string;
}

const AMBER_THRESHOLD_DAYS = 7;
const RED_THRESHOLD_DAYS = 14;

export function followUpSignal(
  isWaitingOnClient: boolean,
  lastActionAt: string | null | undefined,
): FollowUpSignal {
  if (!isWaitingOnClient || !lastActionAt) {
    return { days: null, tone: 'none', message: '' };
  }
  // last_action_at is a DATE string (YYYY-MM-DD). Comparing as UTC
  // midnight to today's UTC midnight gives a full-day count that
  // doesn't drift across timezones.
  const last = new Date(`${lastActionAt.slice(0, 10)}T00:00:00Z`).getTime();
  const today = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z').getTime();
  if (!Number.isFinite(last) || !Number.isFinite(today)) {
    return { days: null, tone: 'none', message: '' };
  }
  const days = Math.max(0, Math.floor((today - last) / 86_400_000));
  if (days < AMBER_THRESHOLD_DAYS) return { days, tone: 'none', message: '' };
  if (days < RED_THRESHOLD_DAYS) {
    return {
      days,
      tone: 'amber',
      message: `${days} days since the last update while waiting on the client. Consider sending a follow-up email.`,
    };
  }
  return {
    days,
    tone: 'red',
    message: `${days} days stuck waiting on the client. Likely dropped — follow up urgently.`,
  };
}
