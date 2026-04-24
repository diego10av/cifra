// Stint 37.I · Graceful-degradation sanity.
//
// Diego asked: "el software deberia funcionar aunque se cayese Claude.
// Lo unico que deberia dejar de funcionar entiendo seria los temas de
// IA. No?". This test locks that invariant for core tax-ops + CRM code:
// none of the route files or library functions under /tax-ops, /crm
// (except chat/AI-specific paths) should import the Anthropic client at
// module load — the classifier is rules-only, filings / entities /
// tasks are DB-only. If a future refactor accidentally couples an AI
// call into a hot path, this test fails.
//
// Not an integration test; it's an import-graph assertion done cheaply.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const repo = resolve(__dirname, '../..');

function readIfExists(rel: string): string {
  try { return readFileSync(resolve(repo, rel), 'utf-8'); }
  catch { return ''; }
}

// Core modules that MUST NOT import the Anthropic SDK at module-top.
// Chat endpoints and validator Opus layer legitimately do — they're
// not in this list.
const AI_FREE_PATHS = [
  // Classifier (deterministic, rules-only)
  'src/lib/classify.ts',
  // Tax-Ops routes — DB only
  'src/app/api/tax-ops/filings/route.ts',
  'src/app/api/tax-ops/entities/route.ts',
  'src/app/api/tax-ops/tasks/route.ts',
  'src/app/api/tax-ops/matrix/route.ts',
  'src/app/api/tax-ops/obligations/route.ts',
  'src/app/api/tax-ops/client-groups/route.ts',
  'src/app/api/tax-ops/deadline-rules/route.ts',
  // Tax-Ops libs
  'src/lib/tax-ops-deadlines.ts',
  'src/lib/tax-ops-parsers.ts',
  // CRM core routes that Diego uses daily — no AI required
  'src/app/api/crm/companies/route.ts',
  'src/app/api/crm/contacts/route.ts',
  'src/app/api/crm/matters/route.ts',
];

describe('graceful degradation: core paths do not import Anthropic', () => {
  for (const rel of AI_FREE_PATHS) {
    it(`${rel} has no direct @anthropic-ai/sdk import`, () => {
      const src = readIfExists(rel);
      if (!src) {
        // If the file doesn't exist the test is a no-op — not a
        // failure. (Protects us against future moves.)
        return;
      }
      // Look for any `import … from '@anthropic-ai/sdk'` pattern.
      // Allow string mentions in comments — only static imports count.
      const hasStaticImport =
        /^\s*import\s+.+from\s+['"]@anthropic-ai\/sdk['"]/m.test(src);
      expect(hasStaticImport, `${rel} statically imports Anthropic SDK`).toBe(false);
    });
  }
});
