// Legal-watch page — surfaces the living legal memory of the tool.
// Source of truth is src/config/legal-sources.ts; this page presents
// it with the maintainer flow (review dates, triage items).

import Link from 'next/link';
import { BookOpenIcon, AlertOctagonIcon, GavelIcon, ScaleIcon, BuildingIcon, ArrowUpRightIcon } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import {
  LU_LAW, EU_LAW, CIRCULARS, CASES_EU, CASES_LU, PRACTICE,
  sourcesDueForReview, type LegalSource,
} from '@/config/legal-sources';

export default function LegalWatchPage() {
  const due = sourcesDueForReview(12);
  const groups: Array<{ label: string; icon: React.ReactNode; map: Record<string, LegalSource>; tone: string }> = [
    { label: 'Luxembourg law',       icon: <GavelIcon size={14} />,     map: LU_LAW,    tone: 'text-brand-600' },
    { label: 'EU law',                icon: <ScaleIcon size={14} />,     map: EU_LAW,    tone: 'text-info-700' },
    { label: 'AED circulars',         icon: <BookOpenIcon size={14} />,  map: CIRCULARS, tone: 'text-amber-700' },
    { label: 'CJEU / EU case law',    icon: <GavelIcon size={14} />,     map: CASES_EU,  tone: 'text-violet-700' },
    { label: 'LU Tribunal / CA',      icon: <GavelIcon size={14} />,     map: CASES_LU,  tone: 'text-teal-700' },
    { label: 'Market practice',       icon: <BuildingIcon size={14} />,  map: PRACTICE,  tone: 'text-ink' },
  ];

  return (
    <div className="max-w-[1100px]">
      <PageHeader
        title="Legal watch"
        subtitle="The living memory: every statute, circular, case and market-practice position the classifier relies on. Update here when the law moves."
      />

      {/* Due-for-review banner */}
      {due.length > 0 && (
        <div className="mb-6 rounded-xl border border-amber/60 bg-gradient-to-br from-[#FEF3CC] to-surface p-5 flex items-start gap-4">
          <div className="w-9 h-9 rounded-lg bg-warning-500 text-white inline-flex items-center justify-center shrink-0">
            <AlertOctagonIcon size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[14px] font-semibold text-ink">
              {due.length} source{due.length === 1 ? '' : 's'} due for re-review
            </h3>
            <p className="text-[12.5px] text-ink-soft mt-1">
              Last reviewed more than 12 months ago. Confirm the citation is still current, then update <code className="text-[11.5px] bg-surface-alt px-1 py-0.5 rounded">last_reviewed</code> in{' '}
              <code className="text-[11.5px] bg-surface-alt px-1 py-0.5 rounded">src/config/legal-sources.ts</code>.
            </p>
            <details className="mt-3">
              <summary className="text-[12px] font-medium text-brand-600 cursor-pointer hover:text-brand-700">
                Show list
              </summary>
              <ul className="mt-2 space-y-1">
                {due.map(s => (
                  <li key={s.id} className="text-[12px] text-ink-soft">
                    <span className="font-mono text-[11px] text-ink-muted">{s.id}</span> · {s.title}
                    <span className="text-ink-muted ml-2">(last {s.last_reviewed})</span>
                  </li>
                ))}
              </ul>
            </details>
          </div>
        </div>
      )}

      {/* Source groups */}
      <div className="space-y-5">
        {groups.map(group => (
          <SourceGroup key={group.label} {...group} />
        ))}
      </div>

      {/* Footer links */}
      <div className="mt-8 pt-5 border-t border-divider grid grid-cols-1 md:grid-cols-2 gap-3">
        <Link
          href="/legal-overrides"
          className="flex items-center gap-3 p-4 rounded-xl border border-border bg-surface hover:border-border-strong hover:shadow-sm transition-all"
        >
          <div className="w-9 h-9 rounded-lg bg-brand-50 text-brand-700 inline-flex items-center justify-center shrink-0">
            <ScaleIcon size={14} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold text-ink">Legal overrides</div>
            <div className="text-[11.5px] text-ink-muted mt-0.5">Rule-level overrides that apply to specific providers or descriptions.</div>
          </div>
          <ArrowUpRightIcon size={14} className="text-ink-muted" />
        </Link>
        <Link
          href="https://legilux.public.lu"
          target="_blank"
          rel="noopener"
          className="flex items-center gap-3 p-4 rounded-xl border border-border bg-surface hover:border-border-strong hover:shadow-sm transition-all"
        >
          <div className="w-9 h-9 rounded-lg bg-info-50 text-info-700 inline-flex items-center justify-center shrink-0">
            <GavelIcon size={14} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold text-ink">Legilux — LU official journal</div>
            <div className="text-[11.5px] text-ink-muted mt-0.5">Check here when a new LU law or règlement grand-ducal is reported.</div>
          </div>
          <ArrowUpRightIcon size={14} className="text-ink-muted" />
        </Link>
      </div>
    </div>
  );
}

function SourceGroup({
  label, icon, map, tone,
}: {
  label: string; icon: React.ReactNode; map: Record<string, LegalSource>; tone: string;
}) {
  const entries = Object.values(map);
  if (entries.length === 0) return null;

  return (
    <section className="bg-surface border border-border rounded-xl shadow-xs overflow-hidden">
      <header className="px-5 py-3 border-b border-divider flex items-center justify-between bg-surface-alt/40">
        <div className="flex items-center gap-2">
          <span className={tone}>{icon}</span>
          <h2 className="text-[13px] font-semibold text-ink tracking-tight">{label}</h2>
          <Badge tone="neutral" size="xs">{entries.length}</Badge>
        </div>
      </header>
      <ul className="divide-y divide-divider">
        {entries.map(s => (
          <li key={s.id} className="px-5 py-3 hover:bg-surface-alt/40 transition-colors">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-[11px] text-ink-muted bg-surface-alt px-1.5 py-0.5 rounded">
                    {s.id}
                  </span>
                  <span className="text-[13px] font-medium text-ink">{s.title}</span>
                  {s.article && (
                    <Badge tone="neutral" size="xs">Art. {s.article}</Badge>
                  )}
                </div>
                <p className="text-[12px] text-ink-soft mt-1.5 leading-relaxed">{s.subject}</p>
                <p className="text-[11.5px] text-ink-muted mt-1.5 italic">{s.relevance}</p>
                {s.notes && (
                  <p className="text-[11px] text-warning-700 mt-1.5">⚠ {s.notes}</p>
                )}
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[10.5px] uppercase tracking-wide text-ink-muted font-semibold">Last reviewed</div>
                <div className="text-[11.5px] text-ink-soft tabular-nums mt-0.5">{s.last_reviewed}</div>
                {s.sources_url && (
                  <a
                    href={s.sources_url}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex items-center gap-1 mt-1.5 text-[11.5px] font-medium text-brand-600 hover:text-brand-700"
                  >
                    Source <ArrowUpRightIcon size={10} />
                  </a>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
