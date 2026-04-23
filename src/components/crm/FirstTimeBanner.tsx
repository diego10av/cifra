'use client';

// ════════════════════════════════════════════════════════════════════════
// FirstTimeBanner — surfaces the Getting Started guide link on the
// CRM home. Once dismissed, writes a localStorage key so it never
// renders again. Pure client-side — no server round trip needed.
// ════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpenIcon, XIcon } from 'lucide-react';

const DISMISS_KEY = 'cifra_crm_help_banner_dismissed';

export function FirstTimeBanner() {
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    try { setDismissed(localStorage.getItem(DISMISS_KEY) === '1'); }
    catch { setDismissed(true); }  // cookies disabled → don't nag
  }, []);

  if (dismissed !== false) return null;

  function close() {
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
    setDismissed(true);
  }

  return (
    <div className="mb-4 border border-brand-200 bg-brand-50 rounded-md p-3 flex items-start gap-3">
      <BookOpenIcon size={16} className="shrink-0 mt-0.5 text-brand-700" />
      <div className="flex-1 text-[12.5px] text-brand-900">
        <div className="font-semibold mb-0.5">New here? Start with the Getting Started guide.</div>
        <div className="text-brand-800">
          5-min daily workflow · 20-min weekly workflow · keyboard shortcuts · best practices for LU PE law.
        </div>
      </div>
      <Link
        href="/crm/help"
        className="shrink-0 inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-brand-600 text-white text-[11.5px] font-semibold hover:bg-brand-700"
      >
        Read the guide →
      </Link>
      <button
        onClick={close}
        className="shrink-0 text-brand-700 hover:text-brand-900"
        aria-label="Dismiss"
        title="Dismiss"
      >
        <XIcon size={14} />
      </button>
    </div>
  );
}
