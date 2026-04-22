# Test-sandbox for AI-drafted patches — design note

**Status**: designed, not yet implemented. Blocker: one GitHub secret Diego
must add. Implementation scoped at ~2-3h of work once unblocked.

Written during stint 23 to capture the architecture so the next session
can pick it up without re-designing.

---

## The problem

Stints 22 + 23.C shipped the AI rule-patch drafter + the Modify/Accept
flow in the legal-watch queue. Migration 024 reserves `ai_patch_tests_pass`
and `ai_patch_tests_output` columns on `legal_watch_queue`. They are
currently always `NULL`.

Why NULL? The drafter runs inside the Vercel serverless function that
handles `POST /api/legal-watch/scan` (triggered by the daily
`cifra-legal-watch-scan` cron at 07:15 CET). Vercel serverless:

- Has no expanded `node_modules` directory (only the Next.js-bundled subset).
- Cannot spawn child processes like `git apply` or `vitest`.
- Has a 5-minute function timeout (Pro plan); running the full vitest
  suite (4s average locally) is fine TIME-wise, but the environment
  just doesn't support it.

Result: Accept button in `PatchProposalBlock.tsx` shows the diff and
commits on click, but the reviewer has no automated confidence that
the diff doesn't break the 587-fixture corpus. "Trust but verify by
eye" is fine for Diego-the-expert, NOT fine for long-term delegation.

## Why it matters

1. **Closes the safety loop on auto-apply**: Accept becomes a one-click
   green-lit action when tests pass. Red, and the button requires a
   ticked "I read the diff and accept responsibility" checkbox.
2. **Prevents silent regressions**: an AI draft that tightens RULE 36
   could subtly break fixture F085. Today we'd only catch it in CI
   post-merge. With the sandbox, we catch it before commit.
3. **Signals the reviewer**: a green "✓ 587 tests pass" badge in the
   queue card immediately tells Diego "this diff is safe to skim and
   approve." A red badge forces a detailed read.

## Options considered

### A) Node child_process in the Vercel function
**Rejected.** Vercel doesn't install a full repo in the function
filesystem; `vitest` + `node_modules` aren't available. Could
in theory Base-64 ship everything, but it's fragile and breaks the
5-minute timeout for any non-trivial patch.

### B) Programmatic vitest in-process
**Rejected.** `createVitest()` from the Vitest Node API can load
modules dynamically, but ESM import caching + module graph rewrites
fight us. Patching a file in memory, re-requiring it, and running
tests that import it is doable in CJS but the cifra codebase is ESM
throughout — the workaround for dynamic re-import in ESM is nasty
and untestable.

### C) Separate long-running VM / container
**Rejected for now.** Would work (DigitalOcean droplet, Fly.io, etc.)
but adds ops surface. No second piece of infra yet; not worth it.

### D) GitHub Actions as test runner ⭐ RECOMMENDED
GA has full node + `npm install` + CLI access to vitest + filesystem
for `git apply`. Perfect fit. Triggers: `workflow_dispatch` (on-demand
via API) + `schedule` (every 5 min as fallback). Reads pending items
from DB via service-role key, writes results back.

## Recommended architecture (option D)

```
┌────────────────────────┐       drafter produces diff
│ legal-watch-scan.ts    │──────────┐
│ (Vercel cron 07:15)    │          │
└────────────────────────┘          │ INSERT ai_patch_diff
                                    ▼
                         ┌────────────────────────┐
                         │ legal_watch_queue row  │
                         │   ai_patch_diff=set    │
                         │   ai_patch_tests_pass  │
                         │     =NULL              │
                         └────────────────────────┘
                                    │
             ┌──────────────────────┼──────────────────────┐
             │ [A] workflow_dispatch│ [B] cron every 5min  │
             │   via GitHub API     │   fallback sweep     │
             ▼                      ▼                      ▼
    ┌────────────────────────────────────────────────────┐
    │ .github/workflows/validate-ai-patch.yml            │
    │                                                     │
    │  steps:                                             │
    │   1. checkout main                                  │
    │   2. npm ci                                         │
    │   3. supabase select: oldest row with              │
    │      ai_patch_diff NOT NULL AND                     │
    │      ai_patch_tests_pass IS NULL                    │
    │   4. git apply --whitespace=nowarn <<< $diff        │
    │   5. npx vitest run --reporter=min 2>&1 | tee out   │
    │   6. supabase update: set                           │
    │      ai_patch_tests_pass=$?                         │
    │      ai_patch_tests_output=<head of out>            │
    │   7. git restore .   (never commit the diff)        │
    └────────────────────────────────────────────────────┘
                                    │
                                    ▼ UPDATE ai_patch_tests_*
                         ┌────────────────────────┐
                         │ queue card picks up    │
                         │ result on next poll    │
                         └────────────────────────┘
```

### Details

- **Trigger from scanner**: after `INSERT INTO legal_watch_queue (…ai_patch_diff…)`,
  `legal-watch-scan.ts` POSTs
  `https://api.github.com/repos/diego10av/cifra/actions/workflows/validate-ai-patch.yml/dispatches`
  with `{ref:"main", inputs:{queue_id:<uuid>}}`. Non-fatal: if it
  fails (rate limit, token miss), the 5-min cron picks it up anyway.
- **Fallback cron**: `schedule: '*/5 * * * *'` so pending rows never
  linger more than 5 minutes.
- **Max items per run**: 1. Keeps the GA minute budget bounded. With
  volume <10 items/week, one-per-run is fine.
- **Timeout**: `timeout-minutes: 10` on the job. Vitest runs in ~4s
  today; `npm install` takes ~60s first run (cached on subsequent
  runs via `actions/setup-node@v4` with cache).
- **Output storage**: `ai_patch_tests_output` truncated to first 4 KB
  (enough for the Vitest FAIL summary but bounded for DB).
- **Blast-radius guard**: same `ALLOWED_FILES` whitelist as the
  apply-patch endpoint. A workflow run that detects an off-list path
  sets `ai_patch_tests_pass=false` with output = "blast-radius violation"
  and exits. Belt + braces with the server-side check.

### UI changes

In `PatchProposalBlock.tsx` (already has the structural place for it):

- When `ai_patch_tests_pass === null`: render muted "⏳ Running tests…"
  pill next to confidence %.
- When `true`: render green "✓ 587 tests pass" pill.
- When `false`: render red "❌ N tests failed · see output" pill,
  clickable to expand `ai_patch_tests_output` in a modal.
- Accept button:
  - `tests_pass = true`: enabled as today.
  - `tests_pass = null`: enabled but with tooltip "Tests still running — the
    result will appear in up to 5 minutes."
  - `tests_pass = false`: disabled UNLESS reviewer ticks a new checkbox
    "I've read the diff and the test output, and I accept the risk."
    Severity = critical tightens this further (already has the
    `readChecked` gate).

## What Diego needs to do (10 min, one-time)

1. **Generate a Supabase service-role key**
   - https://supabase.com/dashboard/project/jfgdeogfyyugppwhezrz/settings/api
   - Copy the `service_role` secret (NOT the `anon` key).

2. **Add 2 GitHub Actions secrets**
   - Go to https://github.com/diego10av/cifra/settings/secrets/actions
   - `New repository secret` × 2:
     - `SUPABASE_URL` = `https://jfgdeogfyyugppwhezrz.supabase.co`
     - `SUPABASE_SERVICE_ROLE_KEY` = the value from step 1
   - These never leave GA — the workflow reads them at runtime.

3. **Tell Claude "sandbox ready"**
   - Next stint I ship `.github/workflows/validate-ai-patch.yml` +
     the scanner trigger hook + UI badge changes. ~2-3h.

## Estimated impact

- At current volume (~5-10 AI-drafted patches / week), zero missed
  regressions going to main. Today Diego does visual review; 99% of
  drafts pass fine but the 1% that wouldn't is hard to spot by eye.
- Saves ~2-3 min of manual "run local tests against this diff" per
  Accept for high-confidence diffs. Over 5 patches/week that's
  ~15 min/week or ~1h/month of Diego's time.
- Unblocks Diego delegating the Accept click to a junior, with the
  test gate as the guardrail. Relevant once the multi-user + roles
  stint is exercised.

## Out of scope (this doc)

- Running the full tsc + Next build (not just vitest) in the sandbox.
  Tests are the highest-signal check; build can come later.
- Test-sandbox for other AI-drafted artifacts (memo drafter, eCDF
  sanity check). Those are read-only outputs; no diff, no test target.
- Automatic rollback if a merged AI-drafted commit breaks CI post-
  merge. Today stint-23's CI workflow catches this and fails the push;
  Diego reverts manually.
