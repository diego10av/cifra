// /tax-ops/fatca-crs — placeholder until the FATCA / CRS workflow is
// built. Diego (stint 40 feedback): "la de FATCA/CRS me sale 'This Page
// Couldn't be Found'. Ponme algo más bonito. De momento no vamos a hacer
// nada porque los que se ocupan son otras personas en mi empresa — algo
// en lo que trabajaremos en el futuro."

import Link from 'next/link';
import { ArrowLeftIcon, ConstructionIcon } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';

export default function FatcaCrsPage() {
  return (
    <div className="space-y-4 max-w-2xl">
      <Link href="/tax-ops" className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <ArrowLeftIcon size={12} /> Back to Tax-Ops overview
      </Link>

      <PageHeader
        title="FATCA / CRS"
        subtitle="Annual FATCA + CRS reporting to AED, due 30 June N+1."
      />

      <div className="rounded-lg border border-border bg-surface-alt/40 px-6 py-10 text-center">
        <ConstructionIcon size={28} className="mx-auto text-ink-muted mb-3" />
        <h2 className="text-base font-semibold text-ink mb-1.5">
          Coming soon
        </h2>
        <p className="text-sm text-ink-soft max-w-md mx-auto leading-relaxed">
          FATCA and CRS reporting is handled by a separate team at this
          firm. We&apos;ll add tracking here once the workflow is defined.
          No data is being recorded yet — any FATCA filings already in
          the database are carried forward but not surfaced in this view.
        </p>
        <div className="mt-4 text-xs text-ink-muted">
          Questions? Ping Diego.
        </div>
      </div>

      <div className="rounded-md border border-border bg-surface px-4 py-3 text-sm text-ink-soft">
        <strong className="text-ink">What this page will eventually show:</strong>
        <ul className="mt-1.5 list-disc list-inside space-y-0.5 text-xs">
          <li>Entity × year matrix with FATCA + CRS filing status</li>
          <li>Reporting FI / NFFE classification per entity</li>
          <li>Due-diligence completion tracking (pre-existing + new accounts)</li>
          <li>XML generation + AED portal submission log</li>
        </ul>
      </div>
    </div>
  );
}
