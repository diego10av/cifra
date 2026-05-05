// ════════════════════════════════════════════════════════════════════════
// Landing page at cifracompliance.com (root domain).
//
// Diego (2026-05-05): "aunque fuera dogfooding tener la página web y
// hacer ahí el sign in. Tengo la dirección comprada y me haría ilusión
// utilizarla aunque fuera solo yo."
//
// Intermediate scope chosen by Diego:
//   - Hero (one screen) with logo + tagline + Sign in CTA.
//   - Three module cards (VAT / Tax-Ops / CRM) so the page feels
//     "complete enough" to show casually if needed.
//   - Sign in button redirects to app.cifracompliance.com/login.
//
// No SEO push (noindex/nofollow set at layout level). No tracking, no
// analytics, no contact form. Pure dogfood — Diego enjoys having the
// domain alive at his name.
// ════════════════════════════════════════════════════════════════════════

import Link from 'next/link';
import { ReceiptIcon, BarChart3Icon, BriefcaseIcon, ArrowRightIcon } from 'lucide-react';

const APP_LOGIN_URL = 'https://app.cifracompliance.com/login';

export default function MarketingPage() {
  return (
    <main className="min-h-screen bg-canvas text-ink">
      {/* Top nav */}
      <header className="border-b border-divider">
        <div className="max-w-[1100px] mx-auto px-6 py-4 flex items-center justify-between">
          <span className="text-base font-semibold text-ink leading-none">
            cifra<span className="text-accent-500">·</span>
          </span>
          <a
            href={APP_LOGIN_URL}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-ink transition-colors"
          >
            Sign in
            <ArrowRightIcon size={14} />
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b border-divider">
        <div className="max-w-[1100px] mx-auto px-6 py-20 md:py-28">
          <h1 className="text-4xl md:text-5xl font-semibold leading-tight tracking-tight text-ink">
            Luxembourg tax compliance,
            <br />
            <span className="text-ink-soft">rebuilt from the law up.</span>
          </h1>
          <p className="mt-6 text-base md:text-lg text-ink-muted max-w-2xl leading-relaxed">
            AI reads. Humans review. Every line carries its LTVA article and CJEU citation, so
            the audit trail writes itself.
          </p>
          <div className="mt-10">
            <a
              href={APP_LOGIN_URL}
              className="inline-flex items-center gap-2 h-11 px-5 rounded-md bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 transition-colors"
            >
              Sign in
              <ArrowRightIcon size={15} />
            </a>
          </div>
        </div>
      </section>

      {/* Modules */}
      <section className="max-w-[1100px] mx-auto px-6 py-16 md:py-20">
        <h2 className="text-2xs font-semibold uppercase tracking-wider text-ink-muted mb-6">
          Three modules, one workspace
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ModuleCard
            icon={<ReceiptIcon size={20} />}
            title="VAT"
            blurb="Invoices to eCDF XML and EC Sales List. Deterministic classifier with 32+ rules citing LTVA articles and CJEU cases. AED letter ingestion with structured extraction."
          />
          <ModuleCard
            icon={<BarChart3Icon size={20} />}
            title="Tax-Ops"
            blurb="A single tracker for every Lux compliance obligation: CIT, NWT, WHT, BCL, subscription tax, FATCA/CRS. Status, deadlines, sign-off, audit trail."
          />
          <ModuleCard
            icon={<BriefcaseIcon size={20} />}
            title="CRM"
            blurb="Companies, contacts, matters, opportunities, tasks, billing — purpose-built for the way a Luxembourg professional manages their book."
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-divider mt-8">
        <div className="max-w-[1100px] mx-auto px-6 py-8 flex items-center justify-between text-2xs text-ink-faint">
          <span>cifracompliance.com</span>
          <a href={APP_LOGIN_URL} className="hover:text-ink-muted transition-colors">
            Sign in →
          </a>
        </div>
      </footer>
    </main>
  );
}

function ModuleCard({ icon, title, blurb }: { icon: React.ReactNode; title: string; blurb: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <div className="inline-flex w-9 h-9 items-center justify-center rounded-md bg-brand-50 text-brand-700 mb-3">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-ink mb-2">{title}</h3>
      <p className="text-sm text-ink-muted leading-relaxed">{blurb}</p>
    </div>
  );
}
