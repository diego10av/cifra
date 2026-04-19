# cifra — Gassner debrief (2026-04-19)

> *"I spent 45 minutes walking the product like I was an AIFM's
> operations director evaluating whether to sign a €15k/year
> contract. Here's what I'd tell Diego if he handed me the keys and
> said 'be honest'. — PG"*

---

## Verdict in one line

**The engine is real. The cabin is half-finished.** You could win
a technical-deep-dive demo tomorrow and lose a buyer's room the day
after, because the buyer's room is where people ask *"what happens
when my preparer fat-fingers a year?"* — and today the answer makes
you look amateur.

---

## What's demo-killer (losing the room in < 3 clicks)

### 1 · "Undo" doesn't exist for most mistakes
A managing partner's first instinct is to click the obvious thing,
mess it up on purpose, and see if the tool catches them. On cifra:

- ❌ **Entity edit form**: `/entities/[id]` shows VAT number, matricule,
  regime — none of it is editable from the UI (the PUT API exists
  unused). Every typo at creation is a permanent scar. *Fix: ~30 min.*
- 🟡 **Declaration delete**: shipped tonight (commit `f55732e`). OK now.
- 🟡 **Invoice delete**: API shipped tonight. UI delete button per
  invoice row in the Review table still pending.
- ❌ **Reopen has no confirmation**. A junior clicks "Reopen" on a
  filed declaration, it silently regresses to review, someone else's
  work is now editable. That's the kind of bug a Big-4 compliance
  officer will never forgive. *Fix: 5 min (add confirm dialog).*
- ❌ **No way to un-file** when a filing_ref was wrong. Reopen → edit →
  re-approve → re-file is 4 clicks across 3 screens. In a paid
  product, one click + a strong confirm. *Fix: ~20 min.*

### 2 · List pages assume you have 3 clients, not 300
- `/declarations`, `/clients`, `/entities` — **no pagination, no
  saved filters, no column sort, no text search beyond a top-bar
  box that navigates instead of filtering.**
- At 50 entities this gets annoying. At 300 it's unusable. The
  beachhead (boutique CSPs, 50-300 entities) hits this in week 2.
- *Fix: server-side list pagination + URL-shareable filters. ~1 day.*

### 3 · No bulk operations at entity-level
- A fiduciary onboarding a new client with 40 SOPARFIs wants to
  bulk-import entities from CSV. Not built (ROADMAP P1.4).
- Bulk-archive? Bulk-change-frequency? Nothing. One-by-one clicks.

---

## What's user-killer (breaks daily use, not demo)

### 4 · Error states are silent or technical

- Some API errors bubble up as raw JSON to the toast. A user saw
  `error: has_entities` earlier — that's a system code, not a
  message. Every error path needs a human message + a suggested
  next action.

### 5 · The "empty state" is still the weakest UX

- Fresh install: login → home → completely empty. The onboarding
  banner helps (good addition), but once you dismiss it, coming
  back a month later finds NO context on what to do next. You land
  on the home and it reads like a dashboard for nobody.
- *Fix: home shows "Current period to prepare: Q4 2026, filing due
  Feb 15. Nothing uploaded yet. Start here →".*

### 6 · Search should be one thing, not three

- Top-bar search navigates. Provider-search in invoices is
  different. Client-name search in `/clients` is a separate input.
  A power user wants ⌘K and everything. Linear-grade command
  palette is ROADMAP P1.6 — it's higher leverage than you think.

### 7 · The role labels / sidebar feedback story needs polish

- Your own label reads "Diego · cifra · founder" which is fine for
  you, but the next reviewer you hire will read the same "Diego"
  unless you build a user-profile picker. Single-user today; ship-
  blocker when two people log in.

---

## What's brand-killer (destroys the vertical-deep positioning)

### 8 · The classifier depth isn't visible unless you dig

The single most defensible thing you have — the 32-rule deterministic
classifier with CJEU citations — is exposed as a cost/accuracy number
on `/settings/classifier`. **That's it.**

A buyer should see the legal citation on every line in the Review
tab. Inline. With hover cards showing the LTVA article + CJEU case.
You have the `legal-sources.ts` indexed. The tooltip component is
ROADMAP P1.9. Building it is *hours*, not days, and it turns every
demo into a sales pitch.

### 9 · The landing (cifracompliance.com) hasn't been wired to DNS

Your positioning doc now says "this is a vertical-deep Veeva-for-LU-
compliance product". Your front door says `app.cifracompliance.com/
marketing` — a URL nobody would type and that signals "we're a tool,
not a company". The middleware is ready (commit `808b6f7`). You need
5 minutes in Vercel + 5 minutes at your registrar.

### 10 · Pro-rata, override log, AED inbox — these are killer features buried one click deep

A Big-4 demo should land on a dashboard that says:
- "2 declarations awaiting your approval"
- "4 AI suggestions overridden this month (export audit trail)"
- "Pro-rata re-computed for Entity X — ratio changed from 21% to
  24%, €4,180 more deductible"

Today they exist but don't surface *without the reviewer knowing
where to look*. The Inbox (commit `[fase 3]`) was a great first
step. It needs a second pass.

---

## What to PROTECT (don't touch these in any refactor)

1. **The classifier + 60-fixture corpus** — your moat. Every feature
   built should reinforce it, never dilute.
2. **The AI override audit PDF** — the compliance-officer-objection
   killer. Make it the centerpiece of every pitch.
3. **The approval portal with signed links** — no-login client
   experience is a genuine differentiator. Preserve the simplicity.
4. **The legal-sources index with review dates** — nobody else does
   this. Don't let a future "just use an LLM for legal lookup"
   temptation kill it.
5. **`ai_mode=classifier_only` per-entity kill switch** — that's how
   you sell into BlackRock-adjacent compliance desks.

---

## What Claude (me) got wrong tonight (accountability)

You called it — I piled features (pro-rata, multi-contact, landing)
before verifying the basics (delete, edit, undo) worked end-to-end.
That's the mistake a junior engineer makes when they confuse *features
shipped* with *product ready*. Apologies. Before I ship anything new
in the next stint, I'm running the punch list above to zero — and
not starting on a new feature until every red item is green.

---

## Recommended sequence for the next 3 stints

**Stint 12 (next session) — "un-break the basics"**:
- Wire entity edit form (30 min)
- Add Reopen confirmation (5 min)
- Invoice-row delete button in Review table (15 min)
- Bulk entity import CSV (4 h)
- Human error messages across the board (2 h)
- Land the DNS for `cifracompliance.com` (user step, 10 min)

**Stint 13 — "make the depth visible"**:
- Inline legal tooltips on every treatment chip (P1.9, 4 h)
- ⌘K command palette with verbs (P1.6, 4 h)
- Home dashboard v2: current-period call-to-action (3 h)

**Stint 14 — "scale to 300 entities"**:
- Server-side pagination on all list pages
- Saved filters via URL
- Column sort / client-side search refinement

**Explicitly deferred until paying customer signal**:
- Peppol / ViDA module (P1.2) — wait for a buyer asking
- Subscription tax module (P1.18) — post-VAT-stability
- Multi-tenant isolation (P2.1) — 2nd paying customer
- Dark mode, keyboard shortcuts beyond ⌘K

---

## The Gassner question to ask yourself tomorrow morning

> *"If three customers onboarded today, which of the above would
> burn me?"*

My read: **1, 2, 4, 5, 8**. Fix those before your next discovery
call. Everything else is polish.

---

*Debrief ends. Ship tight, narrow, deep.*
