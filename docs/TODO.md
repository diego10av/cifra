# cifra · TODO

> **Living action list.** Claude reads this at the start of each
> session and in the daily 8:30 brief. When an item is done, it's
> checked off and moved to "Done this week". When an item has been
> open > 14 days, Claude proposes either acting, deleting, or parking.
>
> **Time-bucket convention:** every item tagged with one of
> `🟢 5min` · `🟡 30min` · `🔴 2h+deep` · `📞 external` · `🧠 decision`
> so the brief can match items to available windows.
>
> **Carry-over convention:** when an item has been open several days,
> Claude keeps it here with an age indicator. This is a feature, not
> a failure. Diego has a day job and two small kids; many things slip.
>
> Last updated: 2026-04-19 (eleventh stint in progress: directors/pro-rata/SPV classification + multi-user + multi-contact + landing page)

---

## 🔥 This week

### Next 48h

- [ ] 🎯 **Self-test the eleventh-stint deliverables** — new classifier rules (directors, SPV, carry), pro-rata UI, multi-contact inheritance, junior-role user, landing page at `cifracompliance.com` root. Walk through /clients/[id] Contacts card, /entities/[id] approvers picker, /declarations/[id] pro-rata section, and give the junior a `/login` credential to see the restricted view.
- [ ] 📞 **Call 2 notaries for SARL-S quote** — Alex Schmitt, Bonn
      Steichen, Notaire Hellinckx or cheaper alternative. Need at
      least 2 quotes to compare. Expected €1,500-2,500 one-off.
- [ ] 🟡 **30min · Set up `contact@cifracompliance.com`** — Google
      Workspace (€5.75/mo) or Fastmail linked to the domain.

### This week (7 days)

- [ ] 🧠 **Read + edit the 3 strategy docs** — ROADMAP, BUSINESS_PLAN,
      positioning. They're Claude's v0.1; your v0.2 makes them yours.
      30 min per doc, skim + mark what to change.
- [ ] 📞 **Schedule 3 customer discovery calls** — from the 20-firm
      list (section below). Message template in your head: "I'm
      building a LU VAT tool. Would love 20 min to learn how you
      prepare returns today, no pitch." LinkedIn DM > cold email > phone.
- [ ] 🔴 **2h deep · Landing page live on cifracompliance.com** —
      copy already in `docs/positioning.md`. Framer or Vercel. Hero +
      3 features + "Request demo" form. Can be done in one evening
      after kids sleep.
- [ ] 🧠 **Draft friendly-customer pilot offer** — one boutique firm
      you already know. 30-50% discount × 6 months in exchange for
      case study + weekly feedback calls. First paid customer
      typically takes 2-4 weeks to close.

### This sprint (14 days)

- [ ] 🧠 **Decide pricing after first 3 calls** — current hypothesis
      €99 / €299 / custom. Anchor question to ask: "What do you
      spend per year on VAT software today?"
- [x] 🟢 **5min · Rename repo `vat-platform` → `cifra`** — GitHub +
      Vercel renames executed 2026-04-18. Code-side rename (package.json,
      PDF creators, docs, copy) shipped. Repo is now `github.com/diego10av/cifra`.
- [ ] 📞 **SARL-S constitution complete** — expected 7-10 days after
      engaging a notary.
- [ ] 🔴 **2h deep · Start P0 #2 multi-user + roles** — only after
      3 customer calls confirm the need (they will). Claude executes
      the implementation; Diego designs the role names + permissions.

---

## 📋 Prospect list (fill as you go)

*Target: 20 LU firms to reach out to. Fill in during commute / wait
times. No pressure to complete in one sitting.*

| Firm | Size | Contact (LinkedIn / email) | Status | Notes |
|------|------|------------------------------|--------|-------|
| _(TBD)_ | | | Not contacted | |
| _(TBD)_ | | | Not contacted | |

*Where to mine: ALFI member directory, ACEL (Chambre experts comptables),
Luxembourg for Finance directory, LinkedIn search "VAT + Luxembourg +
fiduciary + compliance".*

---

## 🧊 Parked (not this sprint)

Things worth remembering but not actionable yet:

- First hire decision (CS or technical) → month 3-6 once revenue
- Bootstrap vs raise (pre-seed €150-300k for 15%?) → month 2
- BE + NL expansion research → month 6
- Big-4 partnership conversation → when 10+ customers
- Logo redesign with a real designer → when cash allows

---

## ✅ Done this week

*(Archived every Monday morning into `docs/archive/TODO-YYYY-WW.md`.)*

**2026-04-22** — Stint 20: Opus 4.7 sweep + §11 actionable-first pruning

Two coordinated passes driven by Diego's two-part question: (a) where could Opus 4.7 materially lift SaaS quality, and (b) which buttons fail the PROTOCOLS §11 test ("if this element disappeared, would the user act differently?").

**Commits `88ab763` + `31e4101` pushed.**

**Opus 4.7 upgrades (5 call paths):**
- **Validator** Opus 4.5 → 4.7. The pitch-killer agent for Big-4 objections; strictly better multi-hop LU-VAT reasoning.
- **Chat "Ask Opus"** Opus 4.5 → 4.7 (both `/api/chat` and `/api/chat/stream` + the ChatDrawer client).
- **Attachment L2 analyze (Opus path)** Opus 4.5 → 4.7. Contract + engagement-letter + advisor-email deep reads with CJEU citations.
- **VAT registration letter extractor** Haiku → Opus 4.7. Diego 2026-04-21 flagged this was "almost completely wrong" on his first real letter. High-stakes (creates entity profile), low-volume (1/entity lifetime).
- **Tier 4 AI proposer** Haiku → Opus 4.7. Avoids a short-lived Haiku bake-in on the brand-new proposer; NO_MATCH cases are the hardest legal reasoning in the corpus so Opus 4.7 is justified.

Pricing table in `anthropic-wrapper.ts` extended with `claude-opus-4-7` (pegged to 4.5 as placeholder until Anthropic public pricing is verified; budget guard is token-authoritative so a wrong peg under-reports cost but doesn't mis-cap). `docs/MODELS.md` matrix + changelog updated.

**Not done autonomously (proposals for Diego):**
- **Memo Drafter agent** (Opus 4.7) — takes a flagged line or override, generates a formal defense memo with CJEU citations. Diego mentioned he wanted this; waiting for OK.
- **Legal-watch auto-triage** (Opus 4.7 on queue items) — proposes which existing RULE each new item affects + severity.
- **eCDF sanity-check explainer** (Opus 4.7 pre-filing) — flags suspicious box deltas vs prior period.

**§11 actionable-first pruning (3 fixes):**
- **Home header** — removed "Upload AED letter" button. An AED arrives ~1x/entity/quarter; permanent button was noise. Stays in ⌘K + entity detail AED tab + Inbox urgent items.
- **Declaration Documents tab** — "Client Excel" + "Prior-year appendix" dropzones collapsed behind a "More upload options" disclosure. Main "Invoices" dropzone now takes full-row width (90%+ of uploads). The secondary zones (10-30% and ~5% of flows) are 1 click away when needed.
- **Review tab** — "Services Rendered — Overall Turnover" section now hides when `entity.has_outgoing=false` AND `outgoingLines.length=0`. Empty "Add outgoing invoice" button on a pure-inbound entity is vanity. Legacy lines always render; reviewer can flip `has_outgoing` on entity edit if needed.

Tests 577/577 green. Typecheck clean. Prod build clean. All 12 critical routes return 200.

**Diego actions when back:**
- 🎯 Send the VAT registration letter sample (tomorrow's promise) — now hits Opus 4.7 extractor + should extract materially better
- 🎯 Test the Ask Opus button in chat → now calls 4.7
- 📝 Decide on the three deferred agents (Memo Drafter / Legal-watch auto-triage / eCDF explainer) — any or all worth ~2-3h each

---

**2026-04-21 (evening, post first-use catastrophe)** — Stint 19: bug-fix + UX overhaul + Tier 4 AI proposer

**Context:** Diego's first real walk-through of the app surfaced multiple critical bugs + UX issues. His blunt feedback: *"de momento la utilidad de la aplicación es 0 porque está llena de BUGS… estamos muy muy lejos de tener algo operativo."* Fully deserved. My classifier moat work was irrelevant without a working basic flow. This stint fixed everything he flagged + added the Tier 4 AI proposer he greenlit.

**Permissions:** `.claude/settings.local.json` switched to `defaultMode: "bypassPermissions"` so Diego stops seeing popups on every routine action.

**Six commits pushed:**

1. **`7d8ea93` — Schema-reference bug fixes (il.direction + d.vat_payable).** `prorata/route.ts` referenced `il.direction` but the column lives on `invoices` (`i.direction`). `closing/route.ts` referenced `d.vat_payable` but the column is `d.vat_due`. Both 500'd their respective pages. One-line fixes each.

2. **`5dbf7c8` — Entity UX overhaul.** POST /api/entities wrapped in try/catch with apiFail so invalid entity_type returns a clean JSON 400 instead of "Unexpected end of JSON input". Migration 021 drops `passive_holding` from the CHECK constraint (pure passive SOPARFIs can't register for VAT → don't belong in cifra per Polysar C-60/90). Removed from EntityEditCard + /entities/new + /clients/new dropdowns (now `<select>` not `<input>`, with 6 valid values). Simplified regime auto-locks frequency=annual on both UI + server. "New client" button added to home header.

3. **`7dd76bb` — UX cleanup.** LifecycleStepper collapses `extracting`+`classifying` into a single visible "Processing" step (DB keeps the 8-state granularity; the UI hides the implementation detail). VatLetterUpload gains drag-and-drop in the non-compact variant. Sidebar drops "Closing" — it's a 10+ entities view, route stays reachable via ⌘K. TriageTag humanises the snake_case codes (`wrong_entity` → "Wrong entity" + 10 more).

4. **`a3cf850` — Tier 4 AI proposer.** New `src/lib/ai-proposer.ts` — Haiku-based proposer that fires when Tiers 1-3 return NO_MATCH. Always flagged with `source='ai_proposer'` so the UI can show "🔮 AI-proposed" distinct from deterministic rules. LU VAT anchors embedded in the system prompt (Art. 40 / 44 / 17§1 / 60ter + BlackRock / Polysar / Versãofast / Fiscale Eenheid X / Finanzamt T II / TP). Budget-gated through existing api_calls tracking. Per-entity opt-out via `ai_mode='classifier_only'`. Strictly whitelisted output against TREATMENT_CODES. Non-throwing on any failure (silent fallback to NO_MATCH). ClassificationResult.source union extended.

**End-to-end walkthrough on prod build (`npm run build && npm start`, bypassing Turbopack's spaces-path hang):**
- All 12 critical routes return 200
- Login works (AUTH_PASSWORD)
- /api/declarations/[id]/prorata returns JSON (il.direction fix verified)
- /api/closing?period=2026-Q2 returns JSON (vat_payable→vat_due fix verified)
- POST /api/entities with invalid entity_type returns clean 400 JSON (no more "Unexpected end")
- POST /api/entities with securitization_vehicle + simplified → auto-locks to annual (server enforced)
- Sidebar renders without "Closing" link
- Home renders with "New client" button
- Entity edit dropdown shows 6 options, no passive_holding

**Diego actions when back:**
- 🎯 Open any declaration → stepper shows "Processing" instead of "Extract/Classify"
- 🎯 /clients/new or /entities/new → drag a PDF onto the drop zone (was click-only)
- 🎯 Try to create an entity with entity_type=soparfi via URL or API → gets a readable "entity_type 'soparfi' is not valid" error (no more JSON crash)
- 🎯 Sidebar no longer shows Closing; hit ⌘K → "closing" → still accessible
- 📝 Send tomorrow the VAT letter example so we iterate the extractor accuracy

**What's still pending for his walkthrough comments:**
- Copy audit (done for triage tags; wider pass needs Diego pointing at specific strings)
- Extractor accuracy iteration (needs his real letter, sent tomorrow)
- Tier 4 AI proposer integration testing with real NO_MATCH cases (needs invoices with edge cases)

---

**2026-04-21 (morning, autonomous block)** — Stint 18: three-slice autonomy push while Diego at the office

Context: Diego asked me to execute autonomously on three high-leverage tasks while he was out. Also this session formalised two things: (1) `.claude/settings.local.json` switched to `defaultMode: "bypassPermissions"` + `Bash(*)` so routine actions stop triggering popups; (2) new feedback memory `feedback_framing_dogfood.md` — cifra is equally a dogfooding + craft project, not purely commercial urgency.

**Three commits pushed, 577/577 tests green, typecheck clean:**

1. **`9011bb3` — Migration 019: CHECK constraint on `entity_type`.** Repairs the stale `soparfi` row inherited from an older seed (onboard-entity → `active_holding`, "Demo SOPARFI SARL" → "Demo Active Holding SARL"), then adds `entities_entity_type_valid` CHECK (NOT VALID → VALIDATE) with the 7 canonical values. Future raw-SQL inserts cannot sneak invalid values back in. Applied to Supabase via MCP.

2. **`d3a7ab7` — Legal-watch automated feed (941 LOC).** Operationalises the "living classifier" principle from `classification-research.md §13`. Migration 020 creates `legal_watch_queue`. `src/lib/legal-watch-scan.ts` fetches public feeds (VATupdate live + built-in sample) and filters by ~90 watchlist keywords (Directive articles, LTVA articles, concepts, jurisdictions, recent case names). API: `POST /api/legal-watch/scan`, `GET /api/legal-watch/queue`, `PATCH /api/legal-watch/queue/[id]` for triage. UI: `LegalWatchQueueCard` at the top of `/legal-watch` with "Scan now" + "Seed samples" buttons; triage via Flag / Escalate / Dismiss. Scheduled task `cifra-legal-watch-scan` runs daily at 07:15 and injects a line into the 08:30 morning brief when new items queue. Never auto-escalates into `src/config/legal-sources.ts` — that stays a reviewer decision + manual code change so every rule change is attributable. 12 new unit tests on the pure parts (`matchKeywords`, `sampleFeedItems`, etc.).

3. **`8b18ef2` — Corpus expansion: 12 borderline fixtures (F096–F107).** Tightens coverage on rule boundaries where earlier reviewer call-outs surfaced blind spots: LU construction with VAT-charged regression guard, Art. 54 hotel non-deductibility, Art. 199a scrap domestic-RC, Art. 57 franchise supplier, credit-intermediation sub-agent chain (Ludwig C-453/05), Skandia/Danske Bank VAT-group cross-border taxable regression guard, BlackRock exclusion of SaaS to funds, Art. 45 opt-in outgoing rent, SV pure cash-flow admin (contrast with servicer-split flag), EU supplier with mistaken foreign VAT as NO_MATCH (reviewer-flag edge case documented), carry to service-GP default-OUT_SCOPE-with-flag per PRAC_CARRY Case B. Extended `CREDIT_INTERMEDIATION_KEYWORDS` with French sub-agent vocabulary needed for F100.

**Diego actions when back at the keyboard:**
- 🎯 Visit `/legal-watch` → click **Seed samples** → see the three flagship cases populate the queue → Flag / Escalate / Dismiss each
- 🎯 Then click **Scan now** → watch live VATupdate fetch result (may be noisy — the watchlist is broad on purpose)
- 🎯 At 07:15 tomorrow the cron fires; check the 08:30 morning brief for "🟪 Legal feed" line
- 🟡 Known deferred: RULE 11X ("EU supplier charged foreign VAT on a service") — logged in F105/F106 fixture notes

**Items flagged from this stint for the ROADMAP**:
- `P1 RULE 11X` — mirror RULE 17X for services (20 lines, clean reviewer message)
- `P1 Legal-watch curia.europa.eu direct fetcher` — VATupdate is a broad aggregator; a direct curia RSS would be more signal-rich
- `P1 Legal-watch AED scraper` — impotsdirects.public.lu has no RSS; worth a scheduled HTML diff

---

**2026-04-21 (morning)** — Stint 17: landing page sign-in affordance

Diego's ask: a "chula, bonita, elegante" landing with login top-right like Stripe / Linear / Vercel. The landing was already shipped (stint 11, Factorial + Linear + Veeva + Stripe inspired) — what was missing was the prominent login access.

Also recording Diego's broader framing shift: this is dogfooding, not an urgency-driven commercial push. The product is first an artifact he enjoys building and using as a LU VAT professional. Sales will follow from signal — no artificial pressure. Saved as feedback memory so future sessions don't over-rotate on "McKinsey" framings again.

**Commit `9b36384`:**
- TopNav gets a "Sign in →" text link with hover-arrow micro-interaction, between the section anchors and the primary "Get in touch" dark pill. Vertical divider separates the anchor group from the CTA cluster.
- Backdrop-blur bumped from sm to md for crisper frosted-glass.
- Login routing: `<a href="/login">` works on both the app subdomain and the root domain (via the existing middleware host-based redirect).
- Fixed the Versãofast citation in the Depth grid — it was still showing the old "Referral fees to a non-LU intermediary" wording; now correctly describes credit intermediation per GC T-657/24.

**Infrastructure: no code change needed.** `src/middleware.ts` already rewrites `cifracompliance.com/` → `/marketing` and redirects every other root-domain path to `app.cifracompliance.com`. When Diego completes the DNS step (see Parked below), the landing will serve at the root URL automatically.

**Diego's DNS step (5–10 min, only he can do this):**
1. Vercel → cifra project → Settings → Domains → add `cifracompliance.com` and `www.cifracompliance.com`.
2. Vercel will show DNS records to add at the registrar:
   - `cifracompliance.com` → A record `76.76.21.21`
   - `www.cifracompliance.com` → CNAME `cname.vercel-dns.com`
3. Wait for DNS propagation (5–60 min). Vercel auto-provisions the SSL cert.
4. Visit `https://cifracompliance.com` → lands on the marketing page with Sign in top-right.

---

**2026-04-20 (evening)** — Stint 16: classifier deep-dive · Versãofast, SV entity type, SOPARFI clarification

Context: Diego flagged three linked issues. (1) Recent CJEU on credit intermediation (Versãofast T-657/24, GC 2025-11-26) not yet reflected — "hace poco una sentencia muy relevante… negociación del crédito para un broker portugués". (2) SOPARFI handling wrong — pure passive SOPARFIs cannot register for VAT; the platform was treating them as generic holdings. (3) Securitisation vehicles (SV) missing entirely — common LU structure with its own Art. 44§1 d pathway via Fiscale Eenheid X C-595/13. Instruction: "pásate el tiempo que haga falta, una hora, dos, tres, dos días, pero hazlo bien. El clasificador como Dios manda… vivo, vivo, vivo."

**Three commits, 553/553 tests green, typecheck clean:**

1. **`382f3c6` — Legal foundations.** classification-research.md §9–§13 written (Versãofast, SOPARFI, SV, fund-vehicle taxonomy, legal-watch live protocol). legal-sources.ts VERSAOFAST corrected (was mis-attributed to "referral fees"), six new CJEU + one LU law entry added (LUDWIG C-453/05, ASPIRO C-40/15, FRANCK C-801/19, BBL C-8/03, WHEELS C-424/11, SV_LAW_2004). Four new PRACTICE entries (SOPARFI default-not-registered, SV management exempt, SV servicer split, credit intermediation safe harbour). New keyword families: CREDIT_INTERMEDIATION, SECURITIZATION_MGMT, SECURITIZATION_SERVICER.

2. **`8cf0e8e` — Classifier engine.** EntityContext.entity_type adds `securitization_vehicle`. New `isQualifyingForArt44D(ctx)` helper centralises the "qualifying fund for Art. 44§1 d" test — returns true for both `fund` and `securitization_vehicle`. RULES 10 / 12 route via helper with SV-specific reason strings (citing Fiscale Eenheid X + Loi 2004/2022). INFERENCE C / D same. RULE 22 (platform deemed supplier) cleaned: Versãofast citation removed, Fenix C-695/20 stays. NEW RULE 36 (credit intermediation): LU→LUX_00 / EU→RC_EU_EX / non-EU→RC_NONEU_EX, always flagged with Versãofast reasoning, defers to direct-evidence RULE 7A when explicit Art. 44§1(a) reference captured. NEW RULE 37 (SV servicer): Aspiro-C-40/15 split flag when `securitization_vehicle` + servicer/debt-collection keywords — returns null treatment, forces reviewer apportionment. RULE 35 `isFinancialRecipient` extended to include SV for DNB Banka / Aviva exclusion. **24 new fixtures F072–F095** covering RULE 36 / 37 paths, SV entity, BlackRock single-supply rule (F086–F087), margin-scheme Art. 56bis (F088–F089), Wheels DB pension non-qualifying (F091), passive-holding + credit intermediation edge case (F090).

3. **`e7ca83d` — UI + seed cleanup.** EntityEditCard dropdown gets "Securitisation vehicle (Loi 2004/2022)" option; per-type advisory notes surface under the dropdown at selection; amber warning banner fires when entity_type = passive_holding AND VAT number / matricule is filled ("pure passive SOPARFI is not a VAT taxable person — Polysar C-60/90 — confirm Cibo-type services or switch to active_holding or remove the entity from cifra"). VALID_ENTITY_TYPES (bulk-import) adds `securitization_vehicle`. SearchBar ⌘K keywords + hint updated. /entities/new + /clients/new Type-field hints fixed (were misleadingly saying "soparfi / aifm / holding" — now list the full valid enum). Seed data (scripts/seed-demo.ts + api/onboarding/seed) had invalid `entity_type: 'soparfi'` — changed to `active_holding` with comment explaining the Cibo-style narrative. vat-letter-extract.ts extractor prompt rewrote the entity_type mapping to cover all six valid values with an explicit anomaly path for the "pure passive SOPARFI appears VAT-registered" case.

**Diego actions when back at the keyboard:**
- 🎯 Visit `/entities/[id]` and Edit — see new SV option + per-type advisory notes
- 🎯 Switch an entity to `passive_holding` with a VAT number → confirm amber Polysar warning fires
- 🎯 Run classifier on a demo declaration with a mortgage-broker invoice → confirm RULE 36 + Versãofast citation in audit trail
- 🟡 Consider: a DB CHECK constraint on entity_type now that the valid enum is stable (migration 019 — parkable)

---

**2026-04-20 (late afternoon)** — Stint 15 follow-up: frequency change propagation

Diego's follow-up: "cuando subo una carta que modifica la periodicidad, se tiene que actualizar la periodicidad de la entidad — de manera automática o manual — y también cuando la carta NO es una VAT registration letter". Two gaps addressed:

1. **Diff modal now shouts frequency / regime changes.** When a replacement VAT letter is uploaded and the extractor detects a frequency or regime change, the diff modal opens with an amber banner ("⚠️ This letter changes how you file going forward — filing frequency: quarterly → monthly") and those fields are sorted to the top with a "RESHAPES FILING" badge. Hard to miss.

2. **Manual path for non-VAT letters.** New `FrequencyChangeModal` + `POST /api/entities/[id]/frequency-change` endpoint. Accepts new frequency (required), optional regime change, effective date, linked document (dropdown of existing official documents), and notes. Audit log records per-column changes plus a dedicated `frequency_change` entry with the full context (source_document_id, effective_from, notes). Two entry points:
   - **"Change frequency" button** in the OfficialDocumentsCard header (and in the slim empty state — so users who've been told orally about a change can record it without attaching a document).
   - **Post-upload nudge**: when a user uploads a kind ≠ `vat_registration` (engagement letter, articles, other), an amber inline banner appears: "Does this letter change the filing frequency? [Update frequency →] [Dismiss]". Pre-links the modal to the just-uploaded document.

No auto-apply — the modal always requires confirmation (Gassner principle). Past filed declarations keep their original period type; only future declarations follow the new cadence.

---

**2026-04-20 (afternoon)** — Stint 15: VAT letter archive + client billing panel

After the stint 14.5 self-critique cleanup, Diego asked for two new surfaces that both flow from "I want to remember what we agreed with this client, not just parse it once":

1. **VAT registration letter storage + versioning.** Uploading during /entities/new or /clients/new now *keeps* the file in Supabase Storage (`entity-docs/<id>/…`) — it used to be parsed-and-discarded. On `/entities/[id]` an **OfficialDocumentsCard** lists the current letter + prior versions (superseded chain), opens each via short-lived signed URLs, and replaces via a single click. Re-uploading a newer letter runs the extractor again, computes a field-by-field diff vs. the live entity (name / VAT / matricule / RCS / address / type / regime / frequency), and opens a modal — **per-field opt-in**, reviewer authority preserved (Gassner). Other document kinds (articles, engagement letter, other) share the same storage surface but skip the diff flow.

2. **Client billing panel.** Per-client fee schedule: monthly / quarterly / annual / annual-summary / VAT-registration (one-off) / ad-hoc-hourly rate + disbursement % (bps) + VAT-on-disbursement flag + currency + free-form notes. **Engagement letter upload** on top (stored at `client-billing/<id>/…`; replaceable; deletable; not versioned because last signed copy binds). **BillingCard** on `/clients/[id]` renders slim empty-state CTA / compact summary / full edit form.

**Migrations applied**: 017 (`entity_official_documents` with self-FK `superseded_by`) and 018 (`client_billing` 1:1 with `clients`, cents-in-bigint, bps-in-integer, strict CHECK constraints).

**New API surface**:
- `POST/GET /api/entities/[id]/official-documents` (upload + list, optional `?history=true`)
- `GET/DELETE /api/entities/[id]/official-documents/[docId]` (signed URL / delete)
- `POST /api/entities/[id]/apply-vat-letter-diff` (whitelisted field patcher, per-column audit)
- `GET/PUT /api/clients/[id]/billing`
- `POST/GET/DELETE /api/clients/[id]/billing/engagement-letter`

**Refactor**: extractor logic moved from `/api/entities/extract-vat-letter/route.ts` into shared `src/lib/vat-letter-extract.ts` so the persist endpoint and the preview endpoint use the same parser.

---

**2026-04-20 (mid-day extras)** — Stint 14.5: pulled on every "debatable" thread from the self-critique

After the stint 14 screen-by-screen review, Diego asked me to (a) ship the intermediary display on /clients/[id], (b) close the approver_role downstream gap, (c) also execute the "debatable value" items I'd flagged rather than leave them. All done in one commit.

**Shipped**:
- ✅ **Intermediary visible + editable** on /clients/[id]: header badge *"via JTC"* + new `EngagedViaCard` between Profile and Contacts. Uses `useDraft` so edits are auto-saved.
- ✅ **Approver_role downstream wiring**: `/api/declarations/[id]/share-link` and `/api/agents/draft-email` now distinguish `approver_role ∈ {approver,cc,both}` when building To: vs Cc:. Plus: intermediary contact (`engaged_via_contact_email`) is automatically added to Cc when present. Legacy-schema fallback in both endpoints so the system stays alive during partial migrations.
- ✅ **Unified creation UX**: `/declarations` no longer has an inline form. Both the home CTA and the list-page "New declaration" button open the same `NewDeclarationModal`. Single source of truth for "create declaration".
- ✅ **Home CTA rethought**: swapped from 2 symmetric buttons to Linear-style. Prominent dark pill *"Search or run a command ⌘K"* leads. Secondary row has New declaration + Upload AED letter. Signals to new users that ⌘K is first-class.
- ✅ **New Client copy polish**: section titles upgraded ("Client" → "Identity", "Primary VAT contact" → "Main point of contact"). Each section now has a 1-sentence lead explaining what it captures. "Type" relabeled to "Relationship" with hint "How you engage with this client".

**ROADMAP Fase 2 addition**:
- D7b: Intermediary as first-class entity. Today it's flat metadata per client (`clients.engaged_via_*`). When the same CSP (e.g. JTC) routes 3+ of your clients, you end up duplicating their contact info. Migrate to an `intermediaries` table + FK when that pain materialises. Data-migration recipe included in the ROADMAP entry.

---

**2026-04-20 (mid-morning)** — Thirteenth stint: deletion + retention maturity (Fase 1 of the Veeva-grade roadmap)

Context: after the cascade-delete shipped, Diego asked "¿así lo tienen los
grandes o podemos ir a mejor?". I mapped cifra against Stripe / Veeva /
Salesforce / GitHub and split the gap into three phases. Fase 1 shipped
in this stint (below). Fase 2 + 3 logged to ROADMAP (deletion maturity
section) for next iterations.

**Shipped**:
- ✅ Migration 015 applied: immutable `audit_log` (triggers block UPDATE +
  DELETE on the table; raise with code 45000 + maintenance hint).
- ✅ Admin-only gate on `?cascade=true` via new `src/lib/require-role.ts`
  helper. Reviewer can read / soft-archive; only admin can cascade.
- ✅ Committed-declaration guardrail: cascade refuses if any child
  declaration is approved / filed / paid, unless
  `?acknowledge_filed=true` is passed. UI surfaces an Art. 70 LTVA
  warning card + a checkbox the reviewer must tick.
- ✅ `/settings/trash` page + `/api/trash` endpoint + restore routes
  (`POST /api/clients/[id]/restore`, `POST /api/entities/[id]/restore`).
- ✅ Retention notice in the modal + the trash page. Honest copy:
  "archived items stay indefinitely today; 90-day auto-purge is on
  the roadmap".

**Fase 2 queued in ROADMAP.md "Deletion + retention maturity" section**:
- D1 Export ZIP before cascade delete (data portability)
- D2 Email-confirmation cooldown for destructive acts on > 50 rows
- D3 Retention policy per-firm (configurable 30/60/90/365d)
- D4 Scheduled purge job with dry-run + preview
- D5 Delete-reason field (required when > 10 entities)
- D6 Auto-snapshot to cold-storage bucket (30d window)

**Fase 3 queued**:
- D7 Write-once audit bucket (S3 Object Lock / WORM)
- D8 Hash-chain on audit_log rows (tamper detection beyond triggers)
- D9 SOC 2 Type I readiness
- D10 21 CFR Part 11 alignment (pharma fund customers)
- D11 Granular cascade control in UI
- D12 Dry-run API flag
- D13 Time-delayed admin-account delete

529 tests green. Typecheck clean.

---

**2026-04-20 (continued pre-dawn, 7am → 10am LU)** — Twelfth stint continued: all the post-audit extras Diego greenlit

After the main Gassner-list commits landed, Diego asked for every
"additional suggestion" I'd flagged. This block logs them.

**Eleven commits pushed (stint 12b)**:

1. ✅ Toast stacking rewrite (`[c1]`) — dedup (same msg within 3s → "×N"
   counter), cap 6, ESC dismiss, Clear-all button. Also discovered
   ToastProvider wasn't mounted anywhere — fixed in the keyboard
   shortcuts commit.

2. ✅ Auto-save drafts (`[c1]`) — `src/lib/use-draft.ts` hook. Wired
   into EntityEditCard: "Unsaved draft" badge, "Discard draft" button,
   "auto-saved 3s ago" timestamp. Tab-close no longer loses work.

3. ✅ Budget warning banner on Home (`[c2]`) — tonal (amber 75-89%,
   red 90-99%, danger ≥100%), progress bar, euro split, CTA to
   /metrics. Silent for junior role.

4. ✅ CSV export of audit trail (`[c2]`) — GET
   /api/declarations/[id]/audit-log.csv with UTF-8 BOM for Excel.
   AuditTrailPanel gets CSV + PDF buttons side-by-side.

5. ✅ Modal primitive (`[c3]`) — Modal + ConfirmModal in
   src/components/ui/Modal.tsx. Portal-rendered, ESC + backdrop
   dismiss, focus management, role=dialog + aria-modal. Six+
   existing ad-hoc modals can migrate opportunistically.

6. ✅ Keyboard shortcuts (`[c4]`) — ShortcutsProvider, "?" help
   overlay, "g x" leader nav (h/c/e/d/i/p/l/a/s). Also mounted
   the missing ToastProvider in the root layout (big silent fix —
   all existing toast.* calls were no-ops until now).

7. ✅ Empty-state illustrations (`[c5]`) — EmptyState upgraded to
   accept `illustration` prop. 7 inline-SVG illustrations
   (inbox / clients / declarations / deadlines / search /
   documents / approved) themed via currentColor. Pages wired:
   /declarations, /entities, /deadlines, /aed-letters.

8. ✅ Entities + Clients list parity (`[c6]`) — URL-synced filters
   + sort (column headers for entities table, dropdown for
   clients cards) + pagination via useListState + ListFooter
   primitives. Refactor-friendly for declarations too.

9. ✅ Cross-entity provider suggestions API (`[c7]`) — GET
   /api/providers/suggestions?provider=X&country=Y. Returns
   dominant treatment + variance across other entities. Backend
   only; UI deferred (needs thought to avoid misleading reviewers).

10. ✅ Closing dashboard (`[c8]`) — /closing + /api/closing. Period
    picker (quarters + year), 6 metric cards, one-row-per-entity
    grid with status pills + VAT payable + Start/Open CTAs. Red-
    tinted rows for "expected but not started". Sidebar +
    command palette + `g p` shortcut wired.

11. ✅ E2E happy-path spec (`[c9]`) — login → seed → view client
    → open declaration → verify pro-rata + treatment chips. Local-
    only (skipped in prod). First mutating spec.

**Stats**:
- 9 commits pushed · 0 migrations · 529 tests green · typecheck
  clean · production build clean.

**Architecture seeds planted (used by future stints)**:
- useDraft — drop-in autosave for any form
- useListState + paginate() — URL-synced list logic
- ListFooter — shared pagination control
- Modal + ConfirmModal — the default dialog primitive
- ShortcutsProvider — central keyboard routing + help overlay
- EmptyState.illustration API — 7 SVGs + an extensible kind set

**Deferred (consciously)**:
- Cross-entity suggestions UI — needs thought; backend ready.
- Responsive ≤720px — ROADMAP P1.5, intentionally next stint.
- Dark mode — ROADMAP P2.4, tokens ready, deferred.
- Declaration-page row-level shortcuts (j/k/a/r) — documented in
  "?" overlay; binding requires a focus-scoped provider on the
  page. Non-blocking.

**Diego actions when he wakes**:
- 🎯 Hit `?` → skim the shortcuts list.
- 🎯 Hit `⌘K` → type "clo" → hit Enter → see the closing dashboard.
- 🎯 Hit `g d` → go to declarations. Then sort + paginate.
- 🎯 Open any declaration → hover a treatment chip → see the rich
  legal tooltip light up on lines re-classified after migration 014.
- 🎯 Run the CSV audit export on an approved declaration.
- 🟡 Stint 11 carry-overs still outstanding: AUTH_PASSWORD_JUNIOR
  env var + cifracompliance.com DNS.

---

**2026-04-19 / 04-20 (overnight, 4am → 7am LU)** — Twelfth autonomous stint: the Gassner-audit punch list to zero

Context: Diego read the Gassner debrief (commit `4a2161c`), agreed fully,
asked for "todo lo que se sugiere". Then the instruction: *"quiero que
implementes ahora mismo TODO lo que se sugiere en el doc de gassner audit.
necesitamos state-of-the-art software."* So I worked the list end-to-end.

**Nine commits pushed (after the two anoche, `f55732e` + `4a2161c`):**

1. ✅ Reopen + Un-file confirmations (commit `2d5f3bc`) — approved → review soft-confirm; filed/paid → review hard-confirm with AED rectification copy. Lifecycle `paid → review` added. PATCH handler clears filing_ref + filed_at + payment_ref + approved_at on backward transitions.

2. ✅ Entity edit form (commit `1ea5ccc`) — `EntityEditCard` component with read-mode summary (legal form, entity type, VAT, matricule, RCS, regime/freq, features) + inline edit form. Entity PUT endpoint wired (was live, unused).

3. ✅ Humaniser for errors (commit `3e58a10`) — 40-entry ERROR_MAP in `src/lib/ui-errors.ts`; `describeApiError` parses 3 envelope shapes; `formatUiError` auto-humanises. 7 new tests. Refactored call sites: declarations status change (was raw alert), client archive, ContactsCard load + save.

4. ✅ Legal tooltips inline (commit `fc87a03`) — migration 014 adds `invoice_lines.classification_reason`. Classifier persists its reason string. TreatmentBadge rewritten with rich hover popover: code + label + description + rule + source + reason with CJEU / LTVA / Directive / Circulaire references highlighted as coral pills + flag-reason card. Makes the moat visible.

5. ✅ Command palette ⌘K (commit `ff1a234`) — SearchBar upgraded with Commands group: 13 action verbs (Create client/entity, Go to clients/entities/declarations/deadlines/legal-watch/classifier/metrics/audit/users/AED/settings, Help). Starter set when empty. Keyword substring matching with simple scoring.

6. ✅ Home v2 "Today's focus" banner (commit `8a8a2fc`) — computes the single highest-leverage next action (overdue → AED urgent → in review → upcoming → empty-state). Tonal colours. Role-aware greeting (Diego / Associate / Reviewer).

7. ✅ Bulk entity import (commit `a1d2540`) — POST /api/entities/bulk-import accepts CSV/TSV rows with per-row validation. New route /clients/[id]/bulk-import: paste → parse → auto-map columns via alias dict → preview first 20 → import. Result screen shows created + skipped with per-row reason. Capped at 500 rows/batch.

8. ✅ Declarations list: URL-persistent filters + column sort + pagination (commit `[latest]`) — status/q/sort/dir/page/size round-trip through URL. Sortable headers with chevron indicators. Page sizes [25, 50, 100, 250], default 50. Client-side (will go server-side when > 1000 rows).

**Stats**:
- 9 commits pushed · 1 migration applied (014) · 529 tests green ·
  Typecheck clean · Production build clean.

**Deferred from the list (explicitly acknowledged):**
- Per-invoice-row delete button — the bulk "Move to excluded"
  already works via MoveDropdown; a row-level kebab menu with "Delete
  whole invoice" is nice-to-have, not critical.
- Pagination for /entities + /clients — same pattern as declarations
  page; next stint.
- DNS / Vercel domain add for cifracompliance.com — Diego's 5-min
  step in the registrar + Vercel dashboard.

**Diego actions when he wakes**:
- 🎯 Re-classify any existing declaration's lines (one-click in the
  declaration page) to populate `classification_reason` on existing
  rows so the rich tooltip lights up.
- 🎯 Try ⌘K → "create client" → Enter.
- 🎯 Open `/clients/[id]/bulk-import` with a 5-row CSV.
- 🎯 Add `AUTH_PASSWORD_JUNIOR` in Vercel so the Associate credential
  activates (stint 11 queue item still outstanding).
- 🟡 Point `cifracompliance.com` at the Vercel project (5-min root
  domain add + DNS).

---

**2026-04-19 (late evening → overnight)** — Eleventh autonomous stint: Gassner-grade execution of the 8-point strategic dump

Context: Diego gave a long strategic-dump message (landing page, CSP vs in-house, multi-contact + auto-inherit, directors natural+legal per C-288/22, pro-rata mixed-use funds, SPV passive holding, "casuísticas fund managers") with the override "QUIERO QUE HAGAS TODO LO QUE PUEDAS ESTA NOCHE. LO QUE DICEN NO DEJES PARA MAÑANA LO QUE PUEDAS HACER HOY". Subsequent clarification: landing page "muy top" Factorial + Veeva + Linear-inspired, no public distribution planned yet; multi-user if free; Gassner/Veeva as the mental model (vertical-deep + premium + multi-product arc); preserve optionality for adjacent verticals.

**Stint plan executed (seven commits pushed):**

1. ✅ **Living docs rewrite** (commit `b5acc3a`) — positioning.md Veeva-first with CSP vs in-house split + multi-product arc + landing direction; ROADMAP.md queued P0 #11-16; TODO.md + CLAUDE.md §4/§8 refreshed.

2. ✅ **Deep technical research doc** (commit `bd71747`) — `docs/classification-research.md`, 456 lines covering six topics: directors (natural settled + legal contested), pro-rata (Art. 50 LTVA + Art. 49§2 non-EU exception), SPV passive-holding hardening, carry interest substance test, waterfall distributions, IGP cross-border + financial exclusion.

3. ✅ **Classification rules + legal sources** (commit `ece13e4`) — 11 new fixtures + 20+ new legal-source entries. RULES 32a/b (directors natural/legal per C-288/22 TP), 33 (carry), 34 + 34/mixed (waterfall), 35 / 35-lu / 35-ok (IGP), 15P (passive-holding LU domestic leg → LUX_17_NONDED). 513 tests green.

4. ✅ **Multi-user + role gating** (commit `e0a2640`) — migrations 011 + 012 + 013 applied via Supabase MCP. Cookie format v2 (`role.sessionId.hmac`), `/api/auth/me`, middleware deny-list for junior on /settings/*, /metrics, /legal-watch, /legal-overrides, /audit, /registrations. Role-aware sidebar. Three password env vars (AUTH_PASSWORD / _REVIEWER / _JUNIOR).

5. ✅ **Landing page** (commit `4d4b07e`) — Factorial + Linear + Veeva + Stripe-inspired at `/marketing`. Hero, "Why vertical", 4-step How it works, 6-stat depth grid + case-law chip row, 10-item multi-product arc, Close CTA + mailto. Static-rendered, noindex/nofollow (private artifact).

6. ✅ **Multi-contact per client + auto-inherit** (commit `cf8a5ea`) — ContactsCard on /clients/[id]; `/api/clients/[id]/contacts*` CRUD; `/api/entities/[id]/client-contacts` lightweight endpoint; ApproversCard "Pick from client contacts" dropdown pre-fills + stores FK.

7. ✅ **Pro-rata library + UI** (commit `[latest]`) — `src/lib/prorata.ts` pure math module (11 new unit tests), `/api/entities/[id]/prorata` CRUD, `/api/declarations/[id]/prorata` server-side compute endpoint, ProrataPanel on /declarations/[id] with three-card headline (total / deductible / non-deductible) + formula trail + legal refs + inline editor + "missing config" red banner.

**Stats**:
- 7 commits pushed · 3 migrations applied (011 / 012 / 013) ·
  524 unit tests green (11 new) · 75 classifier fixtures green ·
  Typecheck clean · Production build clean.
- Docs added: classification-research.md (456 lines) — durable record
  for future stints.

**Queued for next stint (Tier 3)**:
- Pro-rata rendered in the audit-trail PDF
- Entity `org_type` switch (CSP vs in-house — P1.16)
- "Sync approvers from updated contact" button
- Landing-page screenshots (requires real product screenshots)
- Subscription tax module scoping (P1.18)

**Diego actions next morning**:
- 🎯 Log in once to re-issue the cookie in v2 format (existing
  2-part cookies auto-upgrade on next login)
- 🟡 Set `AUTH_PASSWORD_JUNIOR` in Vercel env vars to activate the
  junior role. Share the credential with the junior.
- 🎯 Visit `/marketing` to review the landing page privately
- 🎯 Visit any `/clients/[id]` to add contacts; then `/entities/[id]`
  to test the "Pick from client contacts" picker on approvers
- 🎯 Visit any `/declarations/[id]` to see the ProrataPanel in action

---

**2026-04-19 (afternoon-evening, 16:00 → 19:30)** — Tenth autonomous stint: Tier 1 hardening

After Diego's request for a full strategic review ("revisa todo lo
construido + plan para optimizar + go-to-market fast"), I delivered
a ~3000-word diagnosis + plan. Diego gave unconditional green light
on Tier 1 + headed out for a few hours. I executed all 5 items
autonomously.

**Five commits pushed**:

1. **Observability: Sentry + PostHog, env-guarded** (`commit f0135ee`)
   - Sentry: client/server/edge config files + `instrumentation.ts`.
     Complete no-ops when DSN is absent. Wrapped next.config.ts
     with `withSentryConfig`. Tunnel route `/monitoring`. 10% trace
     sampling in prod, 100% in dev. Session replay disabled pending DPA.
   - PostHog: `posthog-client.ts` with idempotent init + no-op when
     key absent. EU region (eu.i.posthog.com). Person_profiles
     identified-only, autocapture=false, respects DNT.
   - `PostHogProvider.tsx` mounted in root layout. Manual $pageview
     capture on client-side route changes (Suspense-wrapped for Next 15+).
   - First instrumented event: `declaration.status_changed` on
     lifecycle transitions.
   - CSP updated: connect-src adds *.ingest.sentry.io + *.sentry.io +
     *.i.posthog.com. img-src adds PostHog assets. script-src adds
     PostHog toolbar assets.
   - `.env.example` created documenting every var.
   - **Diego action tonight**: paste SENTRY_DSN + POSTHOG_KEY into
     Vercel env, redeploy, both activate.

2. **Classifier accuracy dashboard at /settings/classifier** (`commit 05fe0db`)
   - `src/lib/classifier-accuracy.ts` — pure function runs all 60
     fixtures from synthetic-corpus + returns pass/fail/duration +
     per-archetype breakdown + full failure list with legal_ref.
   - `GET /api/metrics/classifier` wraps it, 30s cache header.
   - UI page: headline "X/60 (Y%)" in tone emerald/warning/danger,
     archetype progress bars, drill-down table of failures with
     expected/got chips side-by-side, rules-exercised footer.
   - Settings index gets a 4th tile linking in.
   - **Catches regressions from Claude model swaps, rule edits,
     legal-sources updates** — the single health signal we now track
     per commit.

3. **Onboarding banner + one-click demo seed** (`commit cd0f93f`)
   - `POST /api/onboarding/seed` — idempotent minimal seed (1 client
     + 1 entity + 2 approvers + 1 review declaration + 4 classified
     invoices covering treatment variety). Guards: refuses if any
     real client already exists. Uses `onboard-` prefix so seeded
     data is distinguishable from `demo-` (scripts/seed-demo.ts).
   - Home-page banner: renders only when `entities.length===0 &&
     !localStorage[dismissed]`. Three actions: Load demo / Create my
     first client / Skip. Dismiss persists per device.
   - **Kills cold-empty-state abandonment** — no more "I open cifra
     and there's nothing here, what now?" for a tester.

4. **Playwright E2E scaffolding + 5 read-only specs** (`commit 0c05ee4`)
   - `playwright.config.ts` with two target modes: `local` (spawns
     npm run dev, localhost:3000) and `prod` (runs against
     app.cifracompliance.com, read-only only).
   - Specs: `auth.spec.ts` (3 tests — login works, wrong pwd errors,
     correct pwd lands home); `navigation.spec.ts` (4 tests — sidebar
     routes for Clients/Declarations/Settings + regression guard that
     AED is NOT top-level anymore); `classifier-dashboard.spec.ts`
     (2 tests — page renders + API returns shape with 0 failures);
     `inbox.spec.ts` (opens + shows rows or clear state);
     `portal.spec.ts` (public portal with garbage token doesn't crash
     + doesn't leak authed app shell).
   - 12 tests total, all read-only, safe against prod.
   - NPM scripts: `test:e2e`, `test:e2e:ui`, `test:e2e:prod`.
   - `e2e/README.md` documents flipping to CI once staging exists.
   - NOT in CI yet — waiting for a staging Supabase project (P1 #23).

5. **Excel import polish: sort_order + currency_amount** (`commit 764d00d`)
   - Fixed sort_order collision: new imports now offset past
     MAX(sort_order), so imported rows sort after existing ones in
     the Review tab.
   - Fixed currency_amount semantics: was writing the EUR-equivalent
     into the "foreign currency amount" column, misleading downstream
     FX validator. Now null when currency != EUR (and FX validator
     correctly flags "needs FX").

**Stats**:
- 5 commits pushed · 2 new packages (@sentry/nextjs, posthog-js/node,
  @playwright/test) · 502/502 unit tests · 0 lint · tsc clean.
- Deploy automático vivo en `app.cifracompliance.com`.

**Tier 1 complete**. Tier 2 starts when Diego returns with:
- Sentry DSN + PostHog key pasted (activates observability)
- 2ª reunión agendada (tells us whether to prioritize polish visible
  or harder E2E tests)
- Excel real del amigo (if received, refine parser with real data)

---

**2026-04-18 (overnight, 23:30 → 07:00)** — Ninth autonomous stint: Excel ingestion + Contract attach L1+L2+L3

Diego brought 2 more ideas from the same customer meeting: (1) clients
often send Excel files instead of PDFs, cifra should ingest those too;
(2) reviewers want to attach contracts / engagement letters / advisor
emails to specific invoices, get AI analysis with legal citations, and
have everything included in the audit PDF. Diego vetoed my "validate
first, build next week" plan with "vamossss" and I built both overnight.

**Features shipped**:

1. **Excel ingestion** (`commit 58ef7c3`)
   - `POST /api/declarations/[id]/excel/preview` — parses xlsx/xlsm/csv
     with exceljs, asks Claude Haiku to map columns to canonical
     invoice fields, returns parsed rows + warnings. Nothing written.
   - Heuristic column-name matcher (EN/FR/DE/ES aliases) as fallback
     when classifier-only mode, budget exhausted, or AI call fails.
     Never blocks the reviewer.
   - Tolerant parsers: European decimals (",") → JS numbers, % VAT
     rates normalised (17 or 0.17), country names → ISO-2, Excel
     serial dates, DD/MM/YY, ISO.
   - `POST /api/declarations/[id]/excel/import` — atomic insert of
     confirmed rows. 1 invoice + 1 invoice_line each,
     extraction_source='excel_import'. Per-row audit entries.
   - `ExcelImportModal.tsx` — 5-phase state machine (pick → previewing
     → review → importing → done). Review phase shows editable mapping
     grid (required fields outlined if unmapped), live-remapped
     preview table, valid/skipped counts.
   - 3rd upload zone in Documents tab: "Client Excel".

2. **Contract attach L1 + L2 + L3** (this commit)
   - Migration 010: `invoice_attachments` table with kind
     (contract/engagement_letter/advisory_email/other), file info,
     L1 fields (user_note, legal_basis), L2/L3 fields (ai_analysis,
     ai_summary, ai_suggested_treatment, ai_citations, ai_analyzed_at,
     ai_model). RLS enabled, updated_at trigger, cascade delete from
     invoices.
   - `POST /api/invoices/[id]/attachments` — multipart upload to
     Supabase storage (bucket 'documents', path 'attachments/…'),
     inserts row, writes audit.
   - `GET /api/invoices/[id]/attachments` — list.
   - `PATCH /api/invoices/[id]/attachments/[attId]` — update
     kind/note/legal_basis.
   - `DELETE /api/invoices/[id]/attachments/[attId]` — soft delete.
   - `GET /api/invoices/[id]/attachments/[attId]/download` —
     60s-signed Supabase URL (no permanent public URLs).
   - `POST /api/invoices/[id]/attachments/[attId]/analyze` — Claude
     reads the PDF/TXT/EML attachment, returns JSON:
     { ai_summary, ai_analysis (markdown), ai_suggested_treatment,
       ai_citations: [{legal_id, quote, reason}] }. Citations are
     validated against cifra's canonical legal map (LU_LAW, EU_LAW,
     CIRCULARS, CASES_EU, CASES_LU — invalid ids dropped). Treatment
     code validated against TREATMENT_CODES — hallucinated codes
     dropped. Respects ai_mode gate.
   - `AttachmentsModal.tsx` — list + upload form (file + kind +
     optional note + legal basis), per-row actions (view, edit,
     analyse, delete), collapsible analysis panel with citations +
     suggested treatment + model/timestamp.
   - Paperclip icon button added to each row in the Review table
     (alongside the Preview icon).
   - `audit-trail-pdf.ts` extended: new "SUPPORTING DOCUMENTS"
     section after events, one stanza per attachment with filename,
     kind, legal basis, reviewer note (wrapped), cifra analysis
     summary (wrapped), suggested treatment, numbered citations.
     Automatic page breaks.

**Stats**:
- 2 commits pusheados (58ef7c3, [pending])
- 2 migraciones nuevas aplicadas (010)
- 502/502 tests verdes · 0 lint · tsc clean
- Deploy automático vivo en `app.cifracompliance.com`

**Demo story para la 2ª reunión**:
*"Excel del cliente llega → cifra lo mapea con AI → review preview →
importar. Y en cualquier factura: adjuntar contrato → cifra lo analiza
→ cita LTVA Art. 44§1 d + CJEU C-169/04 → todo al PDF de auditoría."*

---

**2026-04-18 (late evening, 22:30 → 23:30)** — Eighth autonomous stint: post-first-customer-meeting execution

Context: Diego tuvo su primera reunión de customer discovery hoy con 2
potenciales clientes (un bank escandinavo + una financiera UK). Sacó
feedback concreto y me lo transmitió. Planteamos juntos qué construir
y qué NO construir (Excel round-trip → rechazado, LLM abstraction
premature → rechazado, Bedrock pre-pipeline → rechazado). De 5 ideas,
priorizadas 3 con valor real. Las 3 shipped esta noche.

**Tres features en producción** en `https://app.cifracompliance.com`:

1. **Audit trail con AI override log** (`commit 6243ab8`)
   - Migration 008: `invoice_lines.ai_suggested_treatment/rule` +
     `audit_log.reason`. Backfill: 45/45 líneas ya tienen AI suggestion.
   - Classifier captura la primera opinión del AI via COALESCE
     (nunca reescribe).
   - Nuevo endpoint `GET /api/declarations/[id]/audit-log`.
   - Nuevo tab "Audit" en `/declarations/[id]` con timeline,
     filtros (All / AI overrides / Treatments / Other), summary
     counters, banderas visibles en overrides.
   - PDF export formal (`audit-log.pdf`) con el pitch escrito en el
     footer: "Generated by cifra · cifracompliance.com · Every change
     logged with timestamp and user; retain for compliance."
   - **Este es el pitch killer**: cuando un compliance officer dice
     "no podemos usar AI", Diego le enseña este PDF y le dice "el AI
     nunca toma decisiones, tú sí, y cada override queda aquí para
     una auditoría."

2. **Bulk edit multi-campo** (`commit aaaf627`)
   - POST `/api/invoice-lines/bulk` con nueva acción `update` que
     acepta un `patch` objeto (whitelist: treatment, invoice_date,
     description, note, reviewed, vat_rate, flag_acknowledged) +
     `reason` opcional.
   - Audit por línea (no un placeholder "bulk action") — cada cambio
     aparece individualmente en el AuditTrailPanel.
   - Invoice_date se aplica a los invoices distintos de las líneas
     seleccionadas (no a las líneas directamente).
   - Atómico, en una sola transacción.
   - Nuevo `BulkEditModal.tsx` — layout "checkbox por campo" (solo
     los tickeados se envían), textarea reason, validación inline,
     wire desde `BulkActionBar` con botón "Edit fields…" destacado.
   - **Mata la excusa del Excel round-trip** que las customers
     mencionaron como workaround actual.

3. **AI-mode toggle por entidad** (`commit 6d96d81`)
   - Migration 009: `entities.ai_mode` (`'full'` | `'classifier_only'`)
     con CHECK constraint.
   - Gates en `/api/agents/extract`, `/api/agents/validate`,
     `/api/chat/stream` — devuelven 409 `ai_mode_restricted` con
     mensaje amable si la entidad está en modo classifier-only.
   - Classifier en sí (`src/lib/classify.ts`) no se toca — ya era
     100% determinístico.
   - `AiModeCard` en `/entities/[id]` — dos-botones selector,
     banda naranja cuando activo, badge "Classifier only".
   - **Respuesta visible en demo a "no podemos usar Claude"**:
     flipea el toggle, cifra sigue clasificando el 80% por reglas
     LTVA/CJEU, el reviewer clasifica el resto a mano.

**Bonus shipped**:
- **AED fuera del sidebar** (este commit) — la entrada "AED inbox"
  al nivel raíz no tenía sentido; AED es por-entidad. Ahora: card
  dentro de `/entities/[id]`. Los AEDs urgentes siguen saliendo en
  el Inbox global (esa sí es vista actionable cross-entity).
- La ruta `/aed-letters` queda viva por deep links históricos.

**Cosas cortadas deliberadamente (anti-yak-shaving)**:
- Excel round-trip (Diego me dio permiso de matarla porque bulk
  edit lo sustituye)
- LLM abstraction ("when enterprise asks with contract in hand")
- Página /security marketing-ish ("better as a Word doc")
- "apply to all similar" contextual button (nice-to-have, no core)

**Stats**:
- 4 commits pusheados (6243ab8, aaaf627, 6d96d81, + this)
- 2 migraciones nuevas aplicadas (008, 009)
- 502/502 tests verdes · 0 lint · tsc clean
- Deploy automático vivo en `app.cifracompliance.com`

**Diego actions for 2nd customer meeting**:
- 🎯 Hacer una demo que navegue: /declarations → tab "Audit" →
  mostrar el PDF export → bulk edit "Edit fields..." → toggle AI
  mode a classifier_only en una entidad → probar que extract
  devuelve 409 legible
- 💬 Preparar el guion de objection handling con las 4 vías de AI
  mode (producto), plus classifier-only como respuesta inmediata
- 📞 Esta semana: 3 DMs LinkedIn + 2da reunión con los 2
  potenciales clientes

---

**2026-04-18 (afternoon, 12:30 → 14:15)** — Seventh autonomous stint: migrations + demo polish

Diego had just rotated the GitHub PAT and asked me to run the 5
migrations + prep the app for him to test. Then (in a key protocol
moment captured in PROTOCOLS §12): *"todas estas cosas, si las puedes
hacer tú y la seguridad es buena/alta, no me pidas que las haga yo de
manera manual"* — so I stopped routing paperwork through him and
executed directly.

**Execution — all self-served, no Diego steps:**

- ✅ `PROTOCOLS §12` — "Execute, don't delegate" recorded as permanent
  rule with decision matrix (what to just-do vs. what to still ask).
- ✅ **Supabase migrations 001 → 005 applied** via MCP `apply_migration`
  against project `jfgdeogfyyugppwhezrz`. Migration 004 adjusted in
  flight — referenced `aed_letters` table doesn't exist; corrected to
  real `aed_communications` name before applying.
- ✅ **Backfill verified**: 1 client ("Avallon") from legacy
  `client_name`, 2 entities pointing at it, 2 `entity_approvers` rows
  created from the old inline VAT-contact columns. 0 orphan entities.
- ✅ **3 schema bugs in `/api/inbox/route.ts` surfaced + fixed**:
  `aed_letters` → `aed_communications`, removed dead `filing_deadline`/
  `payment_deadline` columns (don't exist — deadlines are computed via
  `src/lib/deadlines.ts`), `documents.created_at` → `uploaded_at`. Tests
  had been silently green because they ran against empty tables.
- ✅ **RLS enabled (migration 006)** on all 20 public tables + pinned
  `touch_updated_at()` search_path. `service_role` / `postgres` roles
  bypass RLS by default so the app keeps working; `anon` / `authenticated`
  now default-deny. Supabase security advisor: **20 ERROR + 1 WARN → 0
  ERROR + 0 WARN.**
- ✅ **FK covering indexes (migration 007)** — 4 unindexed FKs
  (`chat_messages.api_call_id`, `chat_threads.entity_id`,
  `registrations.entity_id`, `validator_findings.invoice_id`) covered
  via `CREATE INDEX IF NOT EXISTS`.
- ✅ **Lint pass** — Next.js 16 / React 19 upgrade had accumulated 21
  errors + 19 warnings. Fixed all: `react/no-unescaped-entities` (8
  text edits), `react-hooks/purity` in Skeleton.tsx (Math.random →
  deterministic width array), `no-use-before-define` in entities/page.tsx
  (load → useCallback), 15 unused-import warnings, and project-wide
  opt-out of `react-hooks/set-state-in-effect` (it false-positives on
  the standard load-on-mount async pattern used in 10 places — disabled
  with a comment explaining why). **0 errors, 0 warnings** now.
- ✅ **Seed script overhauled** — fixed `aed_letters` → `aed_communications`
  crash, added 2 demo clients + 6 rich approvers (covers the Avallon
  "CSP director LU + Head of Finance PL" case) + `client_id` on
  entities. Now `npm run seed:demo` populates the full
  clients-entities-approvers hierarchy out of the box.
- ✅ **FeedbackWidget `?` shortcut** — press `?` anywhere (unless in
  a text input) to open the feedback modal with textarea focused. Made
  for demo mode — no reaching for the mouse when a tester notices
  something.
- ✅ **Empty-state audit** — walked every major route's empty state.
  Found: /registrations page's empty state was bare ("No registrations
  yet."). Upgraded to include context and purpose. Rest already good.
- ✅ **Git committer identity** fixed locally so every commit stops
  warning about hostname-guessed identity.
- ✅ Commits pushed: migrations 006/007, inbox fix, lint sweep, demo
  polish. **502/502 tests green · tsc clean · 0 lint.**

**What Diego is on the hook for now**: just testing the app. I stopped
queueing admin steps for him.

---

**2026-04-18 (late morning, 11:00 → 12:30)** — Sixth stint: Diego's 3-point structural audit

Diego's framing: "todo lo que se ve tiene que tener una lógica y razón
detrás para estar en un determinado sitio, tiene que aportar algún tipo
de valor, información, sino es mejor que no esté." Grabado como
PROTOCOLS §11. Se aplica retroactivamente.

Three fases, nine commits:

**Fase 1 — Clients as first-class parent + approvers**
- ✅ `PROTOCOLS §11` — "actionable-first" principle recorded
- ✅ `migrations/005_clients_and_approvers.sql` — new `clients` +
  `entity_approvers` tables + `entities.client_id` FK. Auto-backfills
  from existing `client_name`/`csp_name` inline columns.
- ✅ Full CRUD API: `/api/clients`, `/api/clients/[id]`,
  `/api/entities/[id]/approvers`, `/api/entities/[id]/approvers/[approverId]`
- ✅ `/clients` — hierarchical list with expandable entities per client
- ✅ `/clients/new` — 2-step wizard (client first, entity second)
- ✅ `/clients/[id]` — profile + entities + actionable declaration rollup
- ✅ `/entities/new` — standalone wizard with client picker
- ✅ Sidebar "Clients" now routes to `/clients`
- ✅ `ApproversCard` on entity detail: multi-approver with rich contact
  info (role, organisation, country, email + phone tap-to-act)
- ✅ `share-link` + `draft-email` endpoints pre-fill To / Cc from approvers
- ✅ `ShareLinkModal` + `EmailDrafterModal` show approvers list before send

**Fase 2 — Dashboard audit (actionable-first)**
- ✅ `/entities` — removed 4 decorative KPI cards (Entities / Unique
  clients / Simplified / Ordinary — not actionable). Removed inline
  create form. Kept pending-registration filter (IS actionable).
  Added search + Client column linking to `/clients/[id]`.
- ✅ Home — removed "Active clients" KPI, duplicate "In review" counter,
  empty "AI accuracy" placeholder. Kept priority cards (they pass the
  test). Replaced KPI stack with single "Filed this month" momentum chip.
- ✅ Home CTAs now route to `/clients/new` + `/clients`.

**Fase 3 — Inbox replaces the bell**
- ✅ `/api/inbox` — aggregator of 8 categories (client_approved,
  filing/payment overdue/soon, aed_urgent, extraction_errors,
  validator_findings, budget_warn, feedback_new, schema_missing).
  Process-level 60s cache.
- ✅ `InboxButton` — replaces `BellIcon` in TopBar. Badge shows
  critical+warning count only (admin items don't pump the reviewer's
  number). Red if any critical, amber otherwise. Empty state is a
  positive "Inbox is clear" — reinforces "nothing for you to do now".
- ✅ Every row has a clear next action link. Items grouped by severity
  + admin section separated below.

**Diego actions now due**:
- 🔴 Rotate GitHub PAT with `workflow` scope, restore `.github/workflows/ci.yml`
- 🧠 Run migrations in Supabase SQL Editor in order: 001, 002, 003, 004, 005.
- 🎯 Pilot: open the app, go to `/clients` + create your first one via the wizard, drill in, add approvers for the Avallon case (CSP director in LU + head of finance in PL), share an approval link — see the To/Cc pre-fill.

**Next: expect minor feedback from Diego, iterate.**

**2026-04-18 (morning, 09:15 → 10:15)** — Fifth autonomous stint (Diego next to keyboard)
- ✅ **`npm run seed:demo`** — 3 entities (SOPARFI, AIFM SCSp, Holding SARL), 3 review declarations, ~30 invoice_lines covering every treatment code, 3 AED letters, 5 precedents, 40 api_calls for /metrics. `--reset` wipes only `demo-*` prefixed rows.
- ✅ **`docs/TESTING.md`** — 120-checkbox manual test plan across 13 sections. Partner-ready.
- ✅ **Feedback widget** — floating button bottom-right → modal with category + severity + message. Auto-captures URL + entity/declaration. Tolerant of migration 002 missing (localStorage queue). Admin triage at `/settings/feedback`.
- ✅ **CI pipeline** (`.github/workflows-disabled/ci.yml` for now) — typecheck + tests + build + secret-scan. Parked because PAT lacks `workflow` scope.
- ✅ **Error recovery** — `src/lib/api-client.ts` with exponential backoff + timeout + offline short-circuit + envelope parsing. Global `OfflineBanner`.
- ✅ **Observability** — migration 003 + `/settings/logs` admin view. Structured logger now persists error+warn to `app_logs`.
- ✅ **Perf indexes** — migration 004 adds 14 indexes on hot-path columns. `docs/PERFORMANCE.md` documents 6 deferred N+1 fixes with recipes.
- ✅ **A11y pass** — skip-to-content link, aria-labelledby on all modals, icon-button aria-labels, SearchBar labels, DocRow keyboard access. `docs/A11Y.md` tracks 8 deferred items.
- ✅ **Tests +42** — 466 → 502, all green.

**Diego actions now due** (migrations stack up):
- 🔴 **Rotate GitHub PAT** with `workflow` scope → then `mv .github/workflows-disabled/ci.yml .github/workflows/ci.yml`
- 🧠 Run in Supabase SQL Editor, in order: `migrations/001`, `002`, `003`, `004`.
- 🎯 After migrations: `npm run seed:demo` → pick up `docs/TESTING.md` + share with partner.

**2026-04-18 (daytime cont., 08:45 → 09:10)** — Fourth autonomous stint (Diego at breakfast)
- ✅ **Thread rename UI** — hover a conversation in the history panel → pencil icon opens an inline editor; Enter saves, Escape cancels. Reuses the existing PATCH /api/chat/threads/[id] endpoint.
- ✅ **Streaming SSE in chat** — new `/api/chat/stream` POST endpoint returns Server-Sent Events; replies appear token-by-token. Same gates (rate limit / per-user / firm-wide). Typing indicator hides once first delta lands — the growing bubble IS the feedback now.
- ✅ **Admin UI at `/settings/users`** — per-user cap management with the ladder (€1 / €2 / €5 / €10 / €20 / €30). Add / edit / role-toggle / deactivate. Guardrail refuses to demote or deactivate the last active admin. New API: GET/POST `/api/users`, GET/PATCH/DELETE `/api/users/[id]`. Schema-missing banner guides Diego to apply migration 001 if not yet run.
- ✅ **Tests for output generators** (+29): ecdf-xml (17), excel (5), front-page-pdf (7). Each round-trips the output through its parser (pdf-lib, ExcelJS) to catch shape regressions.
- ✅ **Declaration page refactor continued**: extracted DocRow + its four pills (StatusBadge, DocStatusTag, TriageTag, FileIcon) + TreatmentBadge. page.tsx now 1,552 lines (from original 2,637 → 41% reduction). ReviewTable/TableRow/MoveDropdown/BulkActionBar stay because they're coupled to page state.
- ✅ **Tests +60 total this stint** — 437 → 497. Full suite green.
- ✅ Seven commits pushed

**2026-04-18 (daytime, 08:00 → 08:45)** — Second + third autonomous stints (Diego with kids)
- ✅ **Client approval portal (P0 #4) shipped** — HMAC-signed self-contained tokens + public `/portal/[token]` review page + "Share for approval" button in declaration action bar + `ShareLinkModal` with selectable expiry (1–30 days) + copy-link + draft-email helpers. Eliminates the 3-5 email back-and-forth per declaration. No new DB table (token is its own truth, signed with AUTH_SECRET).
- ✅ **Chat markdown-lite rendering** — Claude's replies now render **bold**, `inline code`, bulleted + numbered lists, paragraph breaks. Pure parser (`render-markdown.ts`) + React walker. Legal-ref pills preserved.
- ✅ **+45 tests** (approval-tokens +12, render-markdown +18, ecb +15, ui-errors +8, rate-limit +6, api-errors +9, lifecycle +16 NEW during day; chat-context +7, budget-guard +13, logger +7, rate-limit +8 shipped overnight). **Total 372/372.**
- ✅ Two commits: `3cb55ae` (markdown + tests), `[portal commit]` (approval portal)

**Diego action needed:**
- 🧠 Still pending: run `migrations/001_per_user_ai_budget_and_chat.sql` in Supabase (chat MVP works without, but per-user cap only activates once applied)
- 🎯 Try the new "Share for approval" button: open any declaration in review, top-right action bar has a new "Share" button next to "Approve"

**2026-04-18 (overnight, 00:30 → 07:50)** — Nocturnal autonomous sprint
- ✅ **Rate limiting** on `/api/agents/*` (token bucket per IP × path; 5/min extract, 10/min validate, 15/min draft-email, 60/min classify) — commit [shipped]
- ✅ **Structured logger** (`src/lib/logger.ts`) — bound loggers, structured fields, Error serialization, dev pretty-print / prod JSON-lines. Integrated in 8 critical sites (api-errors, anthropic-wrapper, ecb, extract, draft-email, aed/upload, documents/upload, declarations) — commit [shipped]
- ✅ **SQL migration 001** (`migrations/001_per_user_ai_budget_and_chat.sql`) — adds `users` table, `api_calls.user_id`, `chat_threads`, `chat_messages`. Idempotent, ready to apply in Supabase Studio.
- ✅ **Per-user budget tracking** (`requireUserBudget(userId, estimatedCost?)`) — tolerant of missing migration (permissive fallback) + anthropic-wrapper writes user_id with graceful retry on old schema — commit [shipped]
- ✅ **Chat MVP shipped** — "Ask cifra" drawer in TopBar, Haiku default + "Ask Opus" button, context-aware (entity/declaration from URL), quota banner w/ cost-per-message, rate-limited + budget-gated. Stateless server; client holds conversation — commit [shipped]
- ✅ **docs/MODELS.md** central matrix created + §10 in PROTOCOLS.md, quarterly review rule
- ✅ **Chat pricing decided**: €2/user/mo default cap, Starter/Firm/Enterprise tiers (€1/€2/€10 caps with admin raise ladder €2→€5→€10→€20→€30)
- ✅ **Declaration page refactor** — 2,637-line monolith → 1,662 + 7 extracted modules (_types, _helpers, _atoms, PreviewPanel, OutputsPanel, EmailDrafterModal, FilingPanel). 37% reduction, zero behaviour change — commit [shipped]
- ✅ **Error boundaries** — `app/error.tsx` + `app/global-error.tsx` prevent future white-screen crashes, Copy error details button for support
- ✅ **Loading skeletons** everywhere — wired `PageSkeleton` into /entities/[id], /registrations/[id], /settings (list pages already had them)
- ✅ **Test coverage +31** — rate-limit +6, lifecycle +16 NEW, api-errors +9 NEW. 319/319 total.

**Diego action needed tomorrow:**
- 🧠 Review + run `migrations/001_per_user_ai_budget_and_chat.sql` in Supabase SQL Editor (chat works without it — permissive fallback — but per-user quota only activates once applied)
- 🎯 Try the chat: click "Ask cifra" top-right of any page, ask something

**2026-04-17** — Late-night sprint
- ✅ CRITICAL extractor prompt fix — merge-default behavior (one line per unique VAT treatment, generic descriptions) — prevents the over-splitting that was creating N lines for a single invoice
- ✅ ROADMAP expansion — chat Opus P0, ViDA/Peppol e-invoicing P1, accounting-integrations P2, new Fund-compliance section (#40-47: FATCA/CRS, subscription tax, direct tax, KYC/AML, AIFMD Annex IV, DAC6, CBAM, CESOP)
- ✅ `docs/VIDA.md` — strategic briefing on VAT in the Digital Age (3 pillars, LU timeline, cifra product plan 5 phases, pricing, risks, immediate actions for Diego)
- ✅ Nav cleanup — Legal overrides folded into Legal watch page as prominent top-card; route stays alive for deep-links; sidebar Library group now a single item
- ✅ Pre-existing `@ts-expect-error` cleanup in synthetic-corpus fixture — unblocked clean typecheck

**2026-04-16** — Tonight's sprint
- ✅ Three strategy docs created (ROADMAP, BUSINESS_PLAN, positioning) — commit `4c85c81`
- ✅ Validator UI integration shipped — commit `4c85c81`
- ✅ Protocols + TODO system + memory sync — commit `d349246`
- ✅ Morning brief scheduled task configured — commit `f5a986b`
- ✅ CSP + security headers (HSTS, CSP, XFO, Permissions-Policy, COOP) — commit `a3b49a0`
- ✅ Declaration page Rules-of-Hooks crash + pink cifra wordmark — commit `878d063`
- ✅ Anthropic monthly budget guard (hard-cap at €75, configurable via BUDGET_MONTHLY_EUR) — commit `c302cff`
- ✅ Metrics page rebuilt into real ops dashboard (budget progress bar + daily sparkline + cost-by-agent) — commit `acf0bd0`
- ✅ Registrations → lifecycle state of Client (vat_status) + sidebar trimmed + avatar minimalist — commit [incoming]
- ✅ UI redesign phases 1-3 shipped — commits `e7d4f3b`, `54164da`, `401c5ed`
- ✅ Options A/B/C/D/E all complete (see ROADMAP Shipped)
- ✅ Domain `cifracompliance.com` purchased (2026-04-15)
- ✅ Company name decided: cifra SARL-S

---

*Diego: add to this file during calls, walks, 3am-baby-wake-ups. No
formatting police — just write the item with a time bucket guess.
Claude: keep current, keep tagged, keep humane in briefs.*
