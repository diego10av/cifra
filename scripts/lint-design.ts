#!/usr/bin/env tsx
/**
 * scripts/lint-design.ts — design-system regression guard
 *
 * Stint 47.F3.5. Fails CI when any of these patterns appear in
 * src/:
 *   - text-[Xpx]                     → bypasses type scale tokens
 *   - border-[#…]                    → bypasses colour tokens
 *   - bg-[#…]                        → same
 *   - hover:bg-surface-alt/{x}       where x ≠ 50 → divergent hover
 *   - focus:ring-1 focus:ring-brand  → duplicates the global halo
 *
 * Allow-list: a small set of legacy locations (see ALLOWED below) where
 * Diego intentionally keeps the literal — display-tier KPI numbers
 * (34/44/68 px), error-state ring tints, etc. Adding to the allow-list
 * requires a comment justifying it.
 *
 * Usage:
 *   npm run lint:design          (exits non-zero on violations)
 */

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

interface Violation {
  file: string;
  line: number;
  match: string;
  rule: string;
}

const RULES: Array<{ pattern: RegExp; rule: string; description: string }> = [
  {
    pattern: /text-\[\d+(?:\.\d+)?px\]/g,
    rule: 'no-adhoc-text-size',
    description: 'Use text-{2xs|xs|sm|base|lg|xl|2xl|3xl} tokens',
  },
  {
    pattern: /border-\[#[0-9A-Fa-f]+\]/g,
    rule: 'no-hex-border',
    description: 'Use border-{token}-{tier} from globals.css',
  },
  {
    pattern: /\bbg-\[#[0-9A-Fa-f]+\]/g,
    rule: 'no-hex-bg',
    description: 'Use bg-{token}-{tier} from globals.css',
  },
  {
    pattern: /hover:bg-surface-alt\/(?!50\b)\d+/g,
    rule: 'hover-opacity-canon',
    description: 'Hover canon = hover:bg-surface-alt/50 everywhere',
  },
  {
    pattern: /focus:ring-1\s+focus:ring-brand-\d+/g,
    rule: 'no-duplicate-focus-ring',
    description: 'globals.css owns the focus halo — drop the utility class',
  },
];

// Files where we've documented a deliberate exception. Each entry
// includes the rule that's allowed there + a comment explaining why.
const ALLOWED: Array<{ file: string; rule: string; reason: string }> = [
  // Display-tier hero KPI sizes — to be folded into a future text-display-* tier.
  { file: 'src/app/page.tsx', rule: 'no-adhoc-text-size', reason: 'KPI hero count (34px); future text-display-md token' },
  { file: 'src/app/declarations/[id]/page.tsx', rule: 'no-adhoc-text-size', reason: 'Validator panel headline numbers' },
  { file: 'src/app/closing/page.tsx', rule: 'no-adhoc-text-size', reason: 'Quarter dashboard hero numbers' },
  { file: 'src/app/declarations/page.tsx', rule: 'no-adhoc-text-size', reason: 'Stat KPI big number' },
  { file: 'src/app/clients/page.tsx', rule: 'no-adhoc-text-size', reason: 'Stat KPI big number' },
  // Marketing / landing has its own warm-beige palette — intentional
  // separation from the app-internal token system. Keep until a marketing
  // refresh consolidates the two palettes.
  { file: 'src/app/marketing/page.tsx', rule: 'no-adhoc-text-size', reason: 'Marketing/landing hero typography' },
  { file: 'src/app/marketing/page.tsx', rule: 'no-hex-border', reason: 'Marketing landing palette (warm beige)' },
  { file: 'src/app/marketing/page.tsx', rule: 'no-hex-bg', reason: 'Marketing landing palette (warm beige)' },
  { file: 'src/app/marketing/layout.tsx', rule: 'no-hex-bg', reason: 'Marketing landing palette' },
  // Login uses a single danger-tone border literal; semantic but not yet
  // consolidated into a danger-{tier} pair.
  { file: 'src/app/login/page.tsx', rule: 'no-hex-border', reason: 'login error tone (legacy)' },
  // Validator panel has its own warning/danger highlights — to be migrated
  // when the validator UI is refactored next.
  { file: 'src/components/validator/ValidatorPanel.tsx', rule: 'no-hex-border', reason: 'validator severity tints (legacy)' },
  { file: 'src/components/validator/ValidatorPanel.tsx', rule: 'no-hex-bg', reason: 'validator severity tints (legacy)' },
  // Badge.tsx mentions the old hex literal in a JSDoc comment for history —
  // it's documentation, not an actual className. Lint reads source as text.
  { file: 'src/components/ui/Badge.tsx', rule: 'no-hex-border', reason: 'JSDoc references (not in className)' },
  // Intentional ring-0 to disable focus halo on inline-edit titles.
  { file: 'src/app/tax-ops/tasks/[id]/page.tsx', rule: 'no-duplicate-focus-ring', reason: 'inline-edit title (focus:ring-0)' },
  { file: 'src/app/tax-ops/entities/[id]/page.tsx', rule: 'no-duplicate-focus-ring', reason: 'inline-edit title (focus:ring-0)' },
  // Error-state ring tints (focus:ring-danger-*) — semantic, not brand.
  { file: 'src/components/delete/CascadeDeleteModal.tsx', rule: 'no-duplicate-focus-ring', reason: 'error-state ring-danger-400' },
  { file: 'src/components/crm/CrmFormModal.tsx', rule: 'no-duplicate-focus-ring', reason: 'error-state ring-danger-400' },
  { file: 'src/components/legal-watch/LegalWatchQueueCard.tsx', rule: 'no-duplicate-focus-ring', reason: 'amber callout ring' },
];

function isAllowed(file: string, rule: string): boolean {
  return ALLOWED.some(a => file.endsWith(a.file) && a.rule === rule);
}

function listFiles(): string[] {
  // git ls-files keeps us scoped to checked-in source under src/.
  const out = execSync('git ls-files src', { encoding: 'utf8' });
  return out
    .split('\n')
    .filter(f => f.endsWith('.tsx') || f.endsWith('.ts'))
    .filter(f => !f.includes('__tests__'))
    .filter(Boolean);
}

function scanFile(file: string): Violation[] {
  const content = readFileSync(file, 'utf8');
  const lines = content.split('\n');
  const out: Violation[] = [];
  for (const { pattern, rule } of RULES) {
    if (isAllowed(file, rule)) continue;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const matches = line.match(pattern);
      if (matches) {
        for (const m of matches) {
          out.push({ file, line: i + 1, match: m, rule });
        }
      }
    }
  }
  return out;
}

function main() {
  const files = listFiles();
  const violations: Violation[] = [];
  for (const f of files) {
    violations.push(...scanFile(f));
  }
  if (violations.length === 0) {
    // eslint-disable-next-line no-console
    console.log(`✓ design-lint: 0 violations across ${files.length} files`);
    process.exit(0);
  }
  // Group by rule for a readable report.
  const byRule = new Map<string, Violation[]>();
  for (const v of violations) {
    if (!byRule.has(v.rule)) byRule.set(v.rule, []);
    byRule.get(v.rule)!.push(v);
  }
  // eslint-disable-next-line no-console
  console.error(`✗ design-lint: ${violations.length} violations across ${files.length} files`);
  for (const [rule, vs] of byRule) {
    const meta = RULES.find(r => r.rule === rule);
    // eslint-disable-next-line no-console
    console.error(`\n  ${rule} — ${meta?.description ?? ''} (${vs.length})`);
    for (const v of vs.slice(0, 20)) {
      // eslint-disable-next-line no-console
      console.error(`    ${v.file}:${v.line}  ${v.match}`);
    }
    if (vs.length > 20) {
      // eslint-disable-next-line no-console
      console.error(`    … and ${vs.length - 20} more`);
    }
  }
  // eslint-disable-next-line no-console
  console.error('\nDocs: docs/DESIGN_SYSTEM.md');
  process.exit(1);
}

main();
