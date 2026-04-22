// ════════════════════════════════════════════════════════════════════════
// Rule-patch drafter — Opus 4.7.
//
// Runs after legal-watch-triage. When an item is judged severity
// high/critical with a non-empty affected_rules list, this drafter
// reads cifra's classifier baseline (rules + legal-sources + keyword
// lists + research doc) and proposes the precise code diff needed to
// incorporate the legal development.
//
// Output goes to legal_watch_queue's ai_patch_* columns (migration 024);
// UI renders the diff in a collapsed block with Accept / Modify /
// Reject buttons. The MVP does NOT auto-apply: the reviewer reads the
// diff and runs `git apply` manually from their terminal (or a
// follow-up stint wires the accept endpoint to apply + commit via
// child_process on the dev server).
//
// Defensibility:
//   • Blast radius: drafter is instructed to ONLY touch 4 files:
//     classification-rules.ts, legal-sources.ts, exemption-keywords.ts,
//     synthetic-corpus.ts. Other file paths in the diff → rejected at
//     validation time before the UI shows the patch.
//   • Overlap check: system prompt tells the drafter to return null if
//     the legal item duplicates an already-cited case / keyword.
//   • Confidence floor: items with AI-drafter confidence < 0.6 → null.
//     Reviewer still sees the item in the queue with the triage info;
//     they just don't get a pre-drafted patch.
//   • Every commit produced from an accepted patch is signed
//     `ai_drafted=true` so `git log --grep="ai_drafted"` gives
//     traceability.
// ════════════════════════════════════════════════════════════════════════

import { readFile } from 'node:fs/promises';
import { anthropicCreate } from '@/lib/anthropic-wrapper';
import { logger } from '@/lib/logger';

const log = logger.bind('rule-patch-drafter');
const MODEL = 'claude-opus-4-7';
const REPO_ROOT = '/Users/gonzalezmansodiego/Desktop/VAT Platform/vat-platform';

const WHITELISTED_FILES = [
  'src/config/classification-rules.ts',
  'src/config/legal-sources.ts',
  'src/config/exemption-keywords.ts',
  'src/__tests__/fixtures/synthetic-corpus.ts',
] as const;

export interface PatchDrafterInput {
  title: string;
  summary?: string | null;
  url?: string | null;
  matched_keywords: string[];
  published_at?: string | null;
  triage: {
    severity: 'critical' | 'high' | 'medium' | 'low';
    affected_rules: string[];
    summary: string;
    proposed_action: string;
  };
}

export interface PatchDraft {
  target_files: string[];
  diff: string;
  reasoning: string;
  confidence: number;
  model: string;
}

const SYSTEM_PROMPT_PREFIX = `You are cifra's rule-patch drafter for Luxembourg VAT classifier updates.

Role: cifra's legal-watch triage agent just identified a real legal development (CJEU judgment, AED circular, market-practice shift) that affects one or more existing classifier rules. Your job is to draft the EXACT code changes needed to incorporate this development into cifra's baseline.

You are NOT making a legal judgment about whether to incorporate the change — the reviewer already decided to by virtue of letting this get to you. You are writing the code diff.

Your output is STRICT JSON with this shape:
{
  "target_files": ["src/config/classification-rules.ts", "src/config/legal-sources.ts"],
  "diff": "<unified diff with @@ headers, relative paths, exactly as \`git apply\` expects>",
  "reasoning": "<two-to-three sentences explaining WHY this diff is the right incorporation — which rule it touches, which case/citation it adds, any fixture expansion>",
  "confidence": <float 0.0-1.0>
}

HARD CONSTRAINTS:

1. **Whitelisted files only**: target_files MUST be a subset of:
   - src/config/classification-rules.ts
   - src/config/legal-sources.ts
   - src/config/exemption-keywords.ts
   - src/__tests__/fixtures/synthetic-corpus.ts
   Any other file path in the diff → caller will reject.

2. **Additions preferred over replacements**: prefer ADDING a new legal-source entry + extending a keyword list over REWRITING an existing rule's logic. Net-new fixtures in synthetic-corpus.ts help the test suite prove the change is non-regressive.

3. **Every new CJEU case → a legal-sources entry**: if the diff adds a case citation in a rule's reason string, the same commit must add that case to CASES_EU / CASES_LU with the full structured entry (id, kind, title, citation, jurisdiction, effective_from, subject, relevance, last_reviewed).

4. **Overlap check**: if the legal item duplicates something already indexed (same case number already present, same keyword phrase already in the list), return confidence: 0 and empty diff. The reviewer sees "AI found no new incorporation needed".

5. **Confidence**: 0.8+ only when you are sure which rule to touch and the citation is unambiguous. 0.5-0.7 when the rule mapping is probable but the drafter wasn't given enough context. Below 0.5 — just return empty.

6. **Diff format**: unified diff with file headers, line numbers, context lines. Example:
   \`\`\`
   --- a/src/config/legal-sources.ts
   +++ b/src/config/legal-sources.ts
   @@ -540,6 +540,18 @@ export const CASES_EU: Record<string, LegalSource> = {
      VERSAOFAST: {
        ...
      },
   +  NEW_CASE_ID: {
   +    id: 'NEW_CASE_ID',
   +    kind: 'case_eu',
   +    title: '...',
   +    citation: 'CJEU, C-XXX/YY, DD Month YYYY',
   +    jurisdiction: 'EU',
   +    effective_from: 'YYYY-MM-DD',
   +    effective_until: null,
   +    subject: '...',
   +    relevance: '...',
   +    last_reviewed: 'YYYY-MM-DD',
   +  },
      BLACKROCK: {
   \`\`\`

   The diff must be applyable as-is with \`git apply\`. If you are not sure about exact line numbers, approximate — the reviewer will fix alignment if needed.

7. **Reasoning section**: end with "TESTS TO ADD:" and list any fixture IDs (F126, F127…) you propose, each with a one-line description. The reviewer will add them to the corpus if they accept.

Return STRICT JSON only. No markdown fences around the JSON. The \`diff\` value is a string with embedded newlines (escape them as \\n in the JSON).

---

BASELINE (the code you are patching — this is the TRUTH; cite these files' current contents in your diff):

---`;

async function readBaseline(): Promise<string> {
  // Read the three config files + the fixture index. These are cached
  // as ephemeral in the Anthropic call so subsequent drafts in the
  // same 5-minute window pay ~1/10th the input cost.
  const files = [
    'src/config/classification-rules.ts',
    'src/config/legal-sources.ts',
    'src/config/exemption-keywords.ts',
  ];
  const parts: string[] = [];
  for (const rel of files) {
    const abs = `${REPO_ROOT}/${rel}`;
    try {
      const content = await readFile(abs, 'utf8');
      parts.push(`\n## FILE: ${rel}\n\n\`\`\`typescript\n${content}\n\`\`\`\n`);
    } catch (e) {
      log.warn('baseline read failed', {
        rel,
        err: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return parts.join('\n');
}

function buildUserPrompt(input: PatchDrafterInput): string {
  return [
    '### Legal-watch item to incorporate',
    `title: ${input.title}`,
    input.url ? `url: ${input.url}` : null,
    input.published_at ? `published_at: ${input.published_at}` : null,
    input.matched_keywords.length > 0
      ? `matched_keywords: ${input.matched_keywords.join(', ')}`
      : null,
    '',
    'source summary:',
    input.summary ?? '(no summary)',
    '',
    '### Triage decision (what the previous agent said)',
    `severity: ${input.triage.severity}`,
    `affected_rules: ${input.triage.affected_rules.join(', ')}`,
    `summary: ${input.triage.summary}`,
    `proposed_action: ${input.triage.proposed_action}`,
    '',
    'Draft the code patch. Return STRICT JSON per the schema in the system prompt.',
  ].filter(x => x !== null).join('\n');
}

export async function draftRulePatch(
  input: PatchDrafterInput,
): Promise<PatchDraft | null> {
  // Gate: only draft when triage is severity high or critical AND the
  // affected_rules list is non-empty. Low / medium go back in the
  // queue for reviewer judgment without a patch proposal.
  if (input.triage.severity !== 'critical' && input.triage.severity !== 'high') {
    return null;
  }
  if (input.triage.affected_rules.length === 0) {
    return null;
  }

  try {
    const baseline = await readBaseline();
    const message = await anthropicCreate(
      {
        model: MODEL,
        max_tokens: 3500,
        system: [
          {
            type: 'text',
            text: SYSTEM_PROMPT_PREFIX,
            cache_control: { type: 'ephemeral' },
          },
          {
            type: 'text',
            text: baseline,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [{ role: 'user', content: buildUserPrompt(input) }],
      },
      {
        agent: 'other',
        label: 'rule-patch-drafter',
      },
    );

    const text = message.content
      .filter(c => c.type === 'text')
      .map(c => (c as { text: string }).text)
      .join('')
      .trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      log.warn('rule-patch-drafter: no JSON in response', {
        raw_preview: text.slice(0, 200),
      });
      return null;
    }

    let parsed: {
      target_files?: unknown;
      diff?: unknown;
      reasoning?: unknown;
      confidence?: unknown;
    };
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (e) {
      log.warn('rule-patch-drafter: JSON parse failed', {
        err: e instanceof Error ? e.message : String(e),
      });
      return null;
    }

    const confidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0));
    if (confidence < 0.6) {
      log.info('rule-patch-drafter: confidence too low', { confidence });
      return null;
    }

    const diff = typeof parsed.diff === 'string' ? parsed.diff.trim() : '';
    if (!diff) {
      log.info('rule-patch-drafter: empty diff');
      return null;
    }

    // Blast-radius check: ensure every file path in the diff header
    // is in the whitelist. Uses --- / +++ headers or `diff --git`
    // anchors.
    const filePaths = extractFilePaths(diff);
    if (filePaths.length === 0) {
      log.warn('rule-patch-drafter: no file paths detected in diff');
      return null;
    }
    const offWhitelist = filePaths.filter(p => !isWhitelisted(p));
    if (offWhitelist.length > 0) {
      log.warn('rule-patch-drafter: off-whitelist file(s) in diff', {
        offWhitelist,
      });
      return null;
    }

    const targetFiles = Array.isArray(parsed.target_files)
      ? parsed.target_files.filter((t): t is string => typeof t === 'string')
      : filePaths;
    const reasoning = typeof parsed.reasoning === 'string' ? parsed.reasoning.trim() : '';

    return {
      target_files: targetFiles,
      diff,
      reasoning,
      confidence,
      model: MODEL,
    };
  } catch (err) {
    log.warn('rule-patch-drafter threw', {
      err: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

function extractFilePaths(diff: string): string[] {
  const paths = new Set<string>();
  // Match `--- a/<path>` and `+++ b/<path>`
  for (const m of diff.matchAll(/^(?:---|\+\+\+)\s+[ab]\/(.+?)$/gm)) {
    const p = m[1].trim();
    if (p && p !== '/dev/null') paths.add(p);
  }
  // Fallback: `diff --git a/<path> b/<path>`
  for (const m of diff.matchAll(/^diff --git a\/(.+?) b\/.+?$/gm)) {
    paths.add(m[1].trim());
  }
  return Array.from(paths);
}

function isWhitelisted(path: string): boolean {
  return (WHITELISTED_FILES as readonly string[]).includes(path);
}
