# cifra · TODO

> Concrete tasks for this week. Diego dogfoods; cifra makes his
> work faster. When something breaks during use, write it here.
> When something is fixed, move it to "Done this week" → archive
> on Mondays.
>
> Last updated: **2026-05-05** (post-reset Phases 1-10 + dogfood polish).

---

## 🔥 This week

### Diego — manual steps (3 Vercel clicks, nothing else)

- [ ] **Vercel env vars** (3 minutes):
  - Settings → Environment Variables.
  - **Add**: `ADMIN_PASSWORD` with a string ≥ 12 chars.
  - **Delete**: `AUTH_USERS`, `AUTH_PASS_DIEGO` and any `AUTH_PASS_*`,
    `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`,
    `SENTRY_AUTH_TOKEN`, `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`,
    `BUDGET_MONTHLY_EUR` (default 20€ stays in code), `CRON_SECRET`,
    `CIFRA_ICAL_TOKEN`.
  - **Keep**: `AUTH_SECRET`, `DATABASE_URL`, `ANTHROPIC_API_KEY`,
    Supabase keys, `DEBUG_SECRET`.
  - Then: redeploy from the Vercel dashboard → confirm login at
    `app.cifracompliance.com` with the new `ADMIN_PASSWORD`.

### Claude (next sessions)

- [ ] **Full visual QA pass**: walk each route with preview tools,
      produce a prioritised list (JS console errors, broken layouts,
      500s, design inconsistencies). Diego reviews and picks priorities.
- [ ] **Bug-fix sprint** over the QA list, by priority.

---

## 🧊 Pending decisions

- [ ] Decide whether pages / features Diego only uses "sometimes"
      should stay (e.g. `/closing` dashboard, `/legal-watch` manual
      page, `/audit` log explorer). If they go unused for 2-3 weeks,
      candidates to remove.

---

## ✅ Done this week

**2026-05-06** — Tasks UX polish (1 commit)

- **Tailwind 4 z-index tokens fixed**: `--z-*` → `--z-index-*` in
  `globals.css`. The 5 utilities (`z-popover/modal/drawer/sticky/toast`)
  were silently rendering as `z-index: auto` across 49 files. Visible
  symptom for Diego: Views + Columns dropdowns invisible behind table
  cells. One token rename fixes all popovers, modals, drawers, and
  sticky table headers app-wide.
- **Engagement row indicator**: rows with `subtask_total > 0` now show
  a navy chevron + a small `done/total` chip next to the title. Atomic
  rows keep the muted chevron. Resolves Diego's "no se distingue qué
  filas son engagements".
- **Removed `Templates` toolbar button + placeholder page**: 6 cards
  with disabled "Instantiate (coming soon)" buttons. Failed Rule §11
  (actionable-first). Reinstate when the instantiation flow ships for
  real.

**2026-05-05** — Strategic dogfood-first reset (10 phases)

Diego pivoted from "going to sell soon" to "dogfood-first single-user".
Executed in one long session + follow-on stabilization sessions:

- **Phase 1**: 10 scheduled tasks disabled + deleted (morning brief,
  legal-watch scan, CRM payment reminders / engagement /
  lead-scoring / anniversaries / trash-purge, tax-ops deadline-alerts /
  recurrence-expand, model-tier-watch). Two unused deps removed
  (`@notionhq/client`, `better-sqlite3`). Stale memory file deleted.
- **Phase 2**: Sentry + PostHog removed completely (4 configs +
  custom envelope helper + provider + tracking call + dependencies
  + CSP cleanup + env vars listed for Vercel deletion).
- **Phase 3**: Multi-user auth → single-user (`ADMIN_PASSWORD` env
  var + simple HMAC session cookie). Dropped `/settings/users` +
  `/api/users` + two-person approval rule. Twelve routes refactored
  (`requireRole` → `requireSession`). Migration 080 dropped the
  `users` table.
- **Phase 4**: Bulk delete of sell-features + chat + inbox:
  marketing, portal, approvers, contacts, email drafter,
  onboarding seed, Vercel cron `stuck-followups`, iCal feed, chat
  in-product (4 routes + components + libs + tests), inbox (page +
  endpoint). Migration 081 dropped `entity_approvers`,
  `client_contacts`, `chat_threads`, `chat_messages`. Budget cap
  default 75€ → 20€.
- **Phase 5** (docs): deleted `positioning.md`, `BUSINESS_PLAN.md`,
  `go-to-market-alt-fund-managers.md`. Archived `gassner-audit` and
  `tax-ops-migration-2026-04-24` to `docs/archive/`. Rewrote ROADMAP +
  TODO + PROTOCOLS + CLAUDE to reflect dogfood-first.
- **Phase 6** (QA baseline): smoke pass with preview tools, login
  flow validated, baseline `docs/qa-2026-05-05.md` created with
  manual checklist for Diego.
- **Phase 7** (stabilization): favicon + theme color refresh
  (Phase 7.1), post-login direct redirect to `/tax-ops` (Phase 7.2),
  Modal + Drawer backdrop opacity + blur normalised across the
  primitive plus 8 roll-your-own modals (Phase 7.3).
- **Phase 8** (home dashboard): `/` is now `HomeDashboard` —
  Today's focus (4 actionable cards) + Quick actions (3 primary
  buttons) + Modules (3 cards). New `/api/home` aggregator with
  defensive `safeCount` queries.
- **Phase 9** (landing): `cifracompliance.com` rebuilt with
  intermediate scope — hero + Sign in CTA + 3 module cards. Host-
  based domain split re-introduced in `middleware.ts`.
- **Phase 10** (logo): `Logo` wordmark earns the `·` dot signature
  (option A confirmed). `LogoMark` unchanged. Coherence across
  sidebar / login / landing.

Tests went from 707 → 614 (-93 from the purge), still all green.
Build green, tsc clean, design-lint 0 violations. Migrations 080 +
081 applied to Supabase via MCP.

**2026-05-05** — Pre-dogfood polish (3 commits)

- **Confirm modal sweep**: closed the gap on CIT/NWT opt-out (matrix
  delete-on-first-click); upgraded `window.confirm()` → ConfirmModal in
  5 HIGH-severity pages (companies, contacts, matters, opportunities,
  entities archive). New `useConfirm()` hook gives ConfirmModal the
  ergonomics of a one-liner await.
- **Toast coverage audit**: added `useToast()` feedback to 11 pages
  where mutations were silent — aed-letters upload, client profile
  edit, entity creation/edit, registration creation, legal-override
  delete, feedback triage, prorata config, legal-watch triage,
  rollover commit. Errors that failed silently now surface; success
  confirmations land. Skipped pages with rich inline feedback already
  (FilingEditDrawer, DeadlineRuleEditor, FeedbackWidget, bulk-import).

**2026-05-06** — Pre-dogfood E2E QA + bug fix

- **`scripts/qa-pre-dogfood.ts`** verifies 3 critical flows end-to-end
  (login, upload+extract+classify, AED reader, rollover preview+commit
  +idempotency) against a running dev server. Use a far-future year
  (2099) for rollover tests so QA data stays out of real years.
- **Bug found + fixed**: `/api/tax-ops/rollover?mode=commit` returned
  500 with `RangeError: Invalid time value`. Cause: `computeDeadline`
  for `adhoc_no_deadline` rule_kind returns `effective: ''`; the
  rollover route then passed `''` as `deadline_date` to a DATE column,
  which the postgres-js driver tried to coerce via `Date.toISOString()`
  → throw. Fix: coerce empty string to null at the rollover call site
  (`eff || null`). Regression test in `tax-ops-deadlines.test.ts`
  documents the contract: callers must guard against the empty string.
  Affected tax types: `wht_director_monthly`, `wht_director_adhoc`.
- After fix: all 3 flows pass clean. 614/614 tests, tsc clean,
  design-lint 0.

---

## 📁 Archive

Past weeks archive automatically every Monday into
`docs/archive/TODO-YYYY-WW.md`. Pre-reset there was a "Done this
week" section with ~40 stints (37-67) that no longer applies to
the new positioning; the historical record lives in `git log` +
commit messages, which is where it belongs.
