// Landing page — stint 60 rebuild.
//
// Scope brief (Diego, 2026-04-27): short punchy + Stripe-style + Sign in
// only + only what cifra does TODAY (no roadmap / no pipeline).
//
// Three modules to surface:
//   • Tax-Ops — every LU filing tracked: VAT (annual/quarterly/monthly),
//     CIT, NWT, subscription tax, WHT (director), BCL. Deadlines + sign-
//     off cascade preparer→reviewer→partner + audit trail.
//   • CRM — clients (CSP / end-client / other), entities (SOPARFIs,
//     AIFMs, SCSps), invoice OCR + classification.
//   • AI classifier — 32+ deterministic rules citing LTVA + CJEU + AED
//     circulars. AI suggests, humans decide, every override logged.
//
// Section order (4 sections, ~1 min scroll):
//   1. Hero — headline + subhead + Sign in CTA
//   2. ThreeModules — Tax-Ops / CRM / Classifier (3-up cards)
//   3. DepthProof — stats grid + 4 CJEU cases
//   4. Close — minimal, just nav back to Sign in
//
// Removed vs stint 11: HowItWorks 4-step, Roadmap 10-items grid,
// CTA wall ("Want to see your next return"). The roadmap was Diego's
// explicit ask — "no incluiría nada de lo que son proyectos".

import Link from 'next/link';
import { Logo } from '@/components/Logo';

// ─────────────────── Section primitives ───────────────────

function Container({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`max-w-[1080px] mx-auto px-6 md:px-10 ${className}`}>
      {children}
    </div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-block text-2xs tracking-[0.18em] uppercase font-semibold text-brand-700">
      {children}
    </div>
  );
}

// ─────────────────── Top nav ───────────────────

function TopNav() {
  // Sign in only — per Diego's stint 60 brief. cifra is closed
  // (single-user dogfooding today, private beta when ready); no
  // public sign-up or "Book a demo" CTA on the nav. The mailto for
  // contact lives only in the footer, deliberately understated.
  return (
    <header className="sticky top-0 z-popover bg-[#FBFAF7]/85 backdrop-blur-md border-b border-[#EFEAE2]">
      <Container className="flex items-center justify-between h-14">
        <Link href="/marketing" aria-label="cifra home" className="hover:opacity-90 transition-opacity">
          <Logo />
        </Link>
        <a
          href="/login"
          className="inline-flex items-center h-9 px-4 rounded-md bg-ink text-white text-sm font-medium hover:bg-ink-soft transition-colors"
        >
          Sign in
          <span aria-hidden className="ml-1.5">→</span>
        </a>
      </Container>
    </header>
  );
}

// ─────────────────── Hero ───────────────────

function Hero() {
  return (
    <section className="pt-20 pb-16 md:pt-28 md:pb-20">
      <Container>
        <div className="max-w-[820px]">
          <Eyebrow>Vertical · Luxembourg · Tax</Eyebrow>
          <h1
            className="mt-5 text-[40px] md:text-[60px] leading-[1.04] tracking-[-0.025em] font-semibold text-ink"
          >
            Luxembourg tax compliance,
            <br />
            <span className="text-brand-500">rebuilt from the law up.</span>
          </h1>
          <p className="mt-6 max-w-[640px] text-lg leading-[1.55] text-ink-soft">
            One workspace for every Luxembourg filing your firm owns —
            VAT, corporate tax, subscription tax, withholding, BCL.
            Deadline tracking, multi-stakeholder sign-off, and legal
            citations down to the LTVA article.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-5">
            <a
              href="/login"
              className="inline-flex items-center h-11 px-5 rounded-md bg-ink text-white text-base font-medium hover:bg-ink-soft transition-colors"
            >
              Sign in
              <span aria-hidden className="ml-2">→</span>
            </a>
            <a
              href="#what"
              className="text-base font-medium text-ink-soft hover:text-ink transition-colors underline-offset-4 hover:underline"
            >
              See what cifra does
            </a>
          </div>
          <p className="mt-10 text-sm text-ink-muted max-w-[560px]">
            Built by a Luxembourg VAT professional. Closed beta — if
            you prepare LU fund returns, write to{' '}
            <a
              href="mailto:contact@cifracompliance.com"
              className="text-ink-soft hover:text-ink underline underline-offset-2"
            >
              contact@cifracompliance.com
            </a>.
          </p>
        </div>
      </Container>
    </section>
  );
}

// ─────────────────── What cifra does (3 modules) ───────────────────

function ThreeModules() {
  const modules = [
    {
      eyebrow: 'Tax-Ops',
      title: 'Every LU filing in one calendar.',
      body:
        'VAT (annual / quarterly / monthly), corporate tax, NWT, subscription tax for UCITS / SIF / RAIF, director WHT, BCL reporting. Deadlines auto-tracked per LTVA article. Sign-off cascade preparer → reviewer → partner with timestamps. Calendar feed for Google, Apple, Outlook.',
      bullets: [
        '7 tax types live, statutory deadlines encoded',
        'Big-4 sign-off cascade with audit log',
        'Saved views, bulk actions, board / list / calendar',
      ],
    },
    {
      eyebrow: 'Classifier',
      title: 'Built on the law, not on prompts.',
      body:
        '32+ deterministic classification rules, each citing the LTVA article + CJEU case + AED circular that supports it. BlackRock, Fiscale Eenheid X, DBKAG, Polysar, Titanium, Finanzamt T II — encoded, regression-tested, continuously legal-watched against new circulars.',
      bullets: [
        'Deterministic rules engine — no LLM in the hot path',
        'Override log frozen at first classification',
        'Legal-watch flags rules when new case-law lands',
      ],
    },
    {
      eyebrow: 'CRM',
      title: 'Clients, entities, invoices — connected.',
      body:
        'CSP firms, end-clients, fund families. Entities (SOPARFIs, AIFMs, SCSps) linked to obligations. Invoice OCR with Anthropic Claude classifies into LTVA treatment codes. AI suggests, humans decide, every override is logged for the audit committee.',
      bullets: [
        'Multi-stakeholder per entity (preparer / reviewer / partner)',
        'Invoice OCR + treatment-code classification',
        'AED letter triage with appeal-deadline tracking',
      ],
    },
  ];

  return (
    <section id="what" className="py-20 md:py-24 bg-white border-y border-[#EFEAE2]">
      <Container>
        <div className="max-w-[640px] mb-14">
          <Eyebrow>What cifra does today</Eyebrow>
          <h2 className="mt-4 text-[32px] md:text-[40px] leading-[1.08] tracking-[-0.02em] font-semibold text-ink">
            One workspace, three connected modules.
          </h2>
          <p className="mt-5 text-base leading-[1.65] text-ink-soft">
            cifra ships the daily work — tracking, preparing, signing off,
            filing — for the tax types and clients a Luxembourg fiduciary
            handles every week.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {modules.map((m) => (
            <article
              key={m.eyebrow}
              className="rounded-xl border border-[#EFEAE2] bg-[#FBFAF7] p-7 flex flex-col"
            >
              <Eyebrow>{m.eyebrow}</Eyebrow>
              <h3 className="mt-3 text-xl font-semibold text-ink leading-snug tracking-tight">
                {m.title}
              </h3>
              <p className="mt-3 text-sm leading-[1.6] text-ink-soft">
                {m.body}
              </p>
              <ul className="mt-5 space-y-2 text-sm">
                {m.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-ink-soft">
                    <span
                      aria-hidden
                      className="mt-1.5 inline-block w-1 h-1 rounded-full bg-brand-500 shrink-0"
                    />
                    <span className="leading-snug">{b}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}

// ─────────────────── Depth (stats + 4 cases) ───────────────────

function StatCell({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-white p-6 md:p-7">
      <div className="text-[34px] md:text-[40px] leading-none font-semibold text-ink tracking-tight tabular-nums">
        {value}
      </div>
      <div className="mt-2 text-sm leading-snug text-ink-soft">{label}</div>
    </div>
  );
}

function CaseLi({ c, date, summary }: { c: string; date: string; summary: string }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-1.5 inline-block w-1 h-1 rounded-full bg-brand-500 shrink-0" aria-hidden />
      <span>
        <span className="font-semibold text-ink">{c}</span>
        <span className="text-ink-muted"> · {date}</span>
        <br />
        <span className="text-ink-soft text-sm">{summary}</span>
      </span>
    </li>
  );
}

function Depth() {
  return (
    <section className="py-20 md:py-24">
      <Container>
        <div className="grid md:grid-cols-12 gap-10 items-start">
          <div className="md:col-span-5">
            <Eyebrow>The depth</Eyebrow>
            <h2 className="mt-4 text-[32px] md:text-[40px] leading-[1.08] tracking-[-0.02em] font-semibold text-ink">
              Numbers a Big-4 partner would recognise.
            </h2>
            <p className="mt-5 text-base leading-[1.65] text-ink-soft">
              cifra treats Luxembourg tax like a first-class engineering
              discipline. Every rule is regression-tested. Every legal
              source has a review date. Every AI decision is logged.
            </p>
          </div>

          <div className="md:col-span-7">
            <dl className="grid grid-cols-2 gap-px bg-[#EFEAE2] rounded-xl overflow-hidden border border-[#EFEAE2]">
              <StatCell value="32+" label="classification rules · each citing LTVA + CJEU + circular" />
              <StatCell value="60+" label="legal sources tracked, with review dates" />
              <StatCell value="700+" label="regression tests · run on every commit" />
              <StatCell value="10 yr" label="retention-ready audit trail · AED-defensible" />
            </dl>
          </div>
        </div>

        <div className="mt-14 rounded-xl border border-[#EFEAE2] bg-[#FBFAF7] px-6 md:px-10 py-8">
          <div className="grid md:grid-cols-[auto_1fr] md:gap-10 items-start">
            <div className="text-2xs tracking-[0.18em] uppercase font-semibold text-brand-700 md:mt-1.5 whitespace-nowrap">
              Recent case-law cifra encodes
            </div>
            <ul className="mt-4 md:mt-0 grid md:grid-cols-2 gap-y-4 gap-x-10">
              <CaseLi
                c="CJEU C-288/22 TP"
                date="2023-12-21"
                summary="Natural-person directors are not taxable persons → no VAT on fees."
              />
              <CaseLi
                c="CJEU C-184/23 Finanzamt T II"
                date="2024-07-11"
                summary="Intra-VAT-group supplies are out of scope, definitively."
              />
              <CaseLi
                c="CJEU C-231/19 BlackRock"
                date="2020-07-02"
                summary="Fund-management exemption: services must be specific and essential."
              />
              <CaseLi
                c="CJEU C-77/19 Kaplan"
                date="2020-11-18"
                summary="Cross-border cost-sharing does not qualify for Art. 44 §1 y."
              />
            </ul>
          </div>
        </div>
      </Container>
    </section>
  );
}

// ─────────────────── Footer ───────────────────

function Footer() {
  return (
    <footer className="border-t border-[#EFEAE2]">
      <Container className="py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Logo />
          <span className="text-sm text-ink-muted">· Luxembourg</span>
        </div>
        <div className="flex items-center gap-5 text-sm text-ink-muted">
          <a
            href="mailto:contact@cifracompliance.com"
            className="hover:text-ink transition-colors"
          >
            contact@cifracompliance.com
          </a>
          <Link href="/login" className="hover:text-ink transition-colors">
            Sign in
          </Link>
        </div>
      </Container>
    </footer>
  );
}

// ─────────────────── Page ───────────────────

export default function MarketingHome() {
  return (
    <>
      <TopNav />
      <main>
        <Hero />
        <ThreeModules />
        <Depth />
      </main>
      <Footer />
    </>
  );
}
