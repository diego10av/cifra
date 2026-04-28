'use client';

// FollowUpChip — small visual indicator that pairs with followUpSignal()
// from `./follow-up`. Renders nothing when the signal is `none` so
// fresh rows stay clean; only stuck rows get a colored chip.
//
// Pattern matches the IF / RS / NWT chips already used inside the
// matrix cells: 2xs text, px-1 py-0, inline-flex, native title for
// the tooltip. Designed to sit next to the status dropdown without
// changing column width.

import type { FollowUpSignal } from './follow-up';

const TONE_CLASSES: Record<FollowUpSignal['tone'], string> = {
  none:  '',
  amber: 'bg-amber-100 text-amber-900 border border-amber-300',
  red:   'bg-red-100 text-red-900 border border-red-300',
};

export function FollowUpChip({ signal }: { signal: FollowUpSignal }) {
  if (signal.tone === 'none' || signal.days === null) return null;
  return (
    <span
      className={`inline-flex items-center px-1 py-0 rounded text-2xs font-medium ${TONE_CLASSES[signal.tone]}`}
      title={signal.message}
      aria-label={signal.message}
    >
      ⏰ {signal.days}d
    </span>
  );
}
