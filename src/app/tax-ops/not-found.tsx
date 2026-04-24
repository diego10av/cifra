// Custom 404 for any /tax-ops/* route that isn't in the app router.
// Stint 40.D — replaces the generic Next 404 which Diego found ugly
// when navigating to FATCA/CRS and similar future pages.

import Link from 'next/link';
import { ArrowLeftIcon, CompassIcon } from 'lucide-react';

export default function TaxOpsNotFound() {
  return (
    <div className="max-w-xl mx-auto py-8">
      <div className="rounded-lg border border-border bg-surface px-6 py-10 text-center">
        <CompassIcon size={28} className="mx-auto text-ink-muted mb-3" />
        <h1 className="text-[15px] font-semibold text-ink mb-1.5">
          This Tax-Ops page is not built yet
        </h1>
        <p className="text-[12.5px] text-ink-soft max-w-md mx-auto leading-relaxed">
          Pick a module from the sidebar on the left, or head back to the
          Tax-Ops overview. If you landed here from a bookmark, the page
          may have been renamed or merged into another.
        </p>
        <div className="mt-5 flex items-center justify-center gap-2">
          <Link
            href="/tax-ops"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] rounded-md bg-brand-500 hover:bg-brand-600 text-white font-medium"
          >
            <ArrowLeftIcon size={12} /> Back to overview
          </Link>
        </div>
      </div>
    </div>
  );
}
