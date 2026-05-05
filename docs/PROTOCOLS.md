# Working protocols — Diego ↔ Claude

> Short contract between Diego (founder, single user) and Claude
> (co-builder) on how to operate. Whenever either notices friction,
> propose an amendment here.

---

## 1. The two living documents

Two files in `docs/` carry the live state of the project. **Claude is
responsible for keeping them current; Diego is responsible for reading
them.**

| File | Purpose | Update trigger |
|------|---------|----------------|
| **`docs/ROADMAP.md`** | Now / Next / Later / Out-of-scope buckets | After every commit that ships a ROADMAP item OR discovers a new gap |
| **`docs/TODO.md`** | This week's actions + Done this week | Every session — check off completed items, add new ones |

Plus `CLAUDE.md` (this repo's onboarding) and the static reference
docs (PROTOCOLS, MODELS, DESIGN_SYSTEM, classification-research,
ltva-procedural-rules, etc).

---

## 2. Auto-update discipline (Claude's responsibility)

### When a commit ships a ROADMAP item

- Strike through or move the item to the appropriate bucket
- Commit the ROADMAP update either in the same commit or in the next.

### When a commit resolves a TODO item

- Check the box (`- [x]`)
- Move to "Done this week" with a commit-hash reference

### When a new idea / risk / gap surfaces mid-work

- **Never silently lose it.** Add to ROADMAP or TODO.
- If it's a bug or security issue, elevate immediately in the same
  chat message — don't defer.

---

## 3. Commit hygiene

- Build + tests GREEN before every commit. No "let me fix it next
  commit". 614-test baseline.
- Descriptive commit messages — explain the WHY, not just the WHAT.
- Co-author with Claude (`Co-Authored-By: Claude Opus 4.7 (1M context)
  <noreply@anthropic.com>` line on every commit Claude makes).
- Push every commit (no local-only work). Vercel auto-deploys; CI
  runs typecheck + tests + build there.

---

## 4. Build / test gates

Before claiming a stint done, confirm green:

```bash
npx tsc --noEmit          # type check
npm test                  # unit tests (currently 614)
npm run lint              # lint:design + standard lint
npm run build             # next.js build, catches edge cases
```

CI runs the same suite on every push to `main`. Vercel deploy fails
if any gate fails.

---

## 5. Decision boundaries

| Decision type | Who decides |
|---|---|
| Code / refactor / migration / test / design | Claude alone |
| Adding/removing a doc | Claude alone |
| Strategic pivots (e.g. dogfood-first ↔ vender) | Diego |
| Legal/tax interpretation rules in classifier | Diego (Claude proposes) |
| Cost > €20/mo | Diego |
| External-human dependencies (notary, accountant) | Diego only |

**Test of "Claude alone"**: *"Could Claude do this with reasonable
security and revert if wrong?"* If yes, do it.

---

## 6. Communication style

- **Diego writes Spanish, Claude mirrors Spanish.**
- **Code, commits, docs in English.** Easier to share if dogfooding
  ever opens up.
- **Honesty over encouragement.** No flattery, no false reassurance.
  If Claude thinks an idea is bad, say so + why + what's better.
- **Brevity in chat, detail in docs.** Short replies in conversation;
  full reasoning in commit messages and `docs/`.

---

## 7. Model review cadence (**critical** per Diego, 2026-04-17)

> *"Quiero que siempre uses el mejor modelo disponible para tareas
> importantes. Revisa el catálogo cada vez que abras una sesión nueva."*

`docs/MODELS.md` is the matrix. At session start:

1. Read `docs/MODELS.md`.
2. If a new Claude tier has shipped since last session (Opus N+1,
   Sonnet N+1, Haiku N+1), propose a swap to Diego with:
   - Before/after accuracy on the 60-fixture synthetic corpus
   - Before/after cost per call
   - Recommendation
3. Never silently change a model. Diego decides.
4. Keep the pricing table in `src/lib/anthropic-wrapper.ts` synced
   with `docs/MODELS.md`.

Quarterly review minimum even when no new tier shipped.

---

## 8. Living-docs custody (**critical** per Diego, 2026-04-19)

If Diego says something in chat that contradicts what's in CLAUDE.md /
ROADMAP.md / TODO.md / PROTOCOLS.md, the docs are stale. **Claude
updates them silently in the same stint.** Diego should never have to
say "update the docs."

**Exception — deeply-held position checkpoint**: if Diego's new
direction would REVERSE something deliberated (a hard rule §11/§13/§14,
a shipped architectural decision) — one-line confirmation before
overwriting:

> *"Espera — esto revertiría [X] que acordamos en [Y]. ¿Confirmas el
> pivote, o te he entendido mal?"*

If Diego confirms → update as the new baseline. If Diego was thinking
out loud → the position stands, no edit. For everything incremental
or first-time expressed, skip the checkpoint and update silently.

---

## 9. Hard rules (cross-ref CLAUDE.md §2)

The five hard rules live in CLAUDE.md §2 to keep them visible at
session start:

- **§11** Actionable-first UI principle (2026-04-18)
- **§12** Execute, don't delegate (2026-04-18)
- **§13** Design uniformity across modules (2026-04-26)
- **§14** Strict module independence (2026-05-04)
- **§15** Mac performance hygiene (2026-05-05) — see §10 below

This file expands on the operational ones (§13 detail in
`docs/DESIGN_SYSTEM.md`).

---

## 10. Mac performance hygiene (2026-05-05)

Diego's dev Mac is **8 GB RAM, 4 physical cores** — undersized for the
workload. The Mac hangs when the kernel compressor saturates and starts
swapping to SSD. Until hardware upgrade, follow this hygiene.

### Baseline check at session start

```bash
pkill -f "next dev" 2>/dev/null      # kill orphan dev servers
pkill -f "tsc --watch" 2>/dev/null   # kill orphan typecheck watchers
vm_stat | head -10                   # check pages free + compressor
```

**Healthy thresholds:**
- Pages free > 50 000 (~200 MB)
- Pages stored in compressor < 500 000 (~2 GB)

### Firm rules

- **One cloud sync only.** Dropbox primary; OneDrive must stay closed.
- **Claude desktop OR Claude Code, not both** (each ~600 MB Electron).
- **Microsoft Defender** in on-demand only (real-time scan disabled
  via `sudo mdatp config real-time-protection --value disabled`).
- **Chrome < 10 tabs during dev.** Strategy tabs (Notion, GitHub) in
  a separate window quit before opening dev server.

### Hardware upgrade — when budget allows

MacBook Air M-series with 16 GB minimum, 24 GB preferable. €1300-1500
range. 8 GB is below operational floor for this workload in 2026.

---

## 11. Amendment process

Either of us can propose an amendment to these protocols:

- Edit this file in a commit.
- Change takes effect immediately — no approval ceremony.
- If Diego disagrees, he reverts.

**Principle:** protocols should reduce friction. If a rule feels
bureaucratic, kill it. If we're forgetting things, tighten it.

---

*Last amended: 2026-05-05 — full rewrite for dogfood-first reset.
Removed §2 Morning brief (scheduled task deleted), §9 Scheduled tasks
(all 10 deleted). Re-numbered remaining sections.*
