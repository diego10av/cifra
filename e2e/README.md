# cifra — E2E tests (Playwright)

End-to-end tests driving a real browser against either a local dev
server or the deployed production URL. These complement the 502
vitest unit tests — unit tests verify pure logic, E2E verifies that
the product actually works as a user sees it.

## Running locally

```bash
# Against a local dev server (spawned automatically).
# Requires a populated .env.local.
npm run test:e2e

# Single spec, with UI debugger:
npx playwright test e2e/auth.spec.ts --ui

# Against the deployed app (read-only tests only):
E2E_TARGET=prod npm run test:e2e
```

## Design principles

1. **Every mutating test is skipped by default**. They have
   `test.skip(...)` with a comment explaining why — they need a
   staging Supabase project to avoid polluting production. When that
   exists, flip the skip to `test(...)`.

2. **Read-only tests are safe anywhere**. They verify navigation,
   UI structure, and data rendering without POST / PATCH / DELETE.
   Safe to run against `app.cifracompliance.com` for a pre-deploy
   smoke check.

3. **Selectors prefer role + text** over data-testid. A test that
   clicks `getByRole('button', { name: 'Approve' })` survives a
   refactor; one that clicks `.btn-approve-123` breaks on every
   class rename.

4. **One concern per spec file**. `auth.spec.ts`, `navigation.spec.ts`,
   `classifier-dashboard.spec.ts`, etc. Easier to run just the
   flow you care about during active development.

## CI wiring — on the TODO list

CI does not run E2E tests yet. Needed first:
- A staging Supabase project (separate DB, separate storage bucket).
- GitHub Actions secrets for staging env vars.
- A `staging` branch / deploy that runs the mutating suite end-to-end.

Once those three exist, add a `playwright` job to `.github/workflows/ci.yml`.
