// ════════════════════════════════════════════════════════════════════════
// similarity.ts (stint 40.A)
//
// Name-similarity helpers for entity deduplication. Pure functions, no
// external deps. Used by:
//   - /api/tax-ops/entities/dedupe-candidates (groups near-duplicates)
//   - /tax-ops/settings/dedupe (UI)
//
// The core problem: Diego's Excel import left many entities with trivial
// name variations ("Avallon MBO Fund III SCA;" vs "Avallon MBO Fund III
// S.C.A.") that refer to the same underlying entity. We need a similarity
// score robust to:
//   - Punctuation differences (. , ; :)
//   - Luxembourg legal-form suffixes (S.à r.l. vs SARL vs S.a.r.l.)
//   - Case differences
//   - Unicode vs ASCII (é vs e, à vs a)
//   - Trailing/leading whitespace
// ════════════════════════════════════════════════════════════════════════

/**
 * Luxembourg + common legal-form suffixes. Each alternate is written
 * with optional whitespace between letters so both "SARL" (compact)
 * and "S a r l" (from "S.a.r.l." with dots stripped to spaces) match.
 * Dots are stripped before this regex runs; accents are folded too.
 *
 * Order matters: longer / more specific forms come first so "scsp"
 * wins over "scs" and "sicavraif" wins over "sicav".
 */
const LEGAL_SUFFIX_REGEX = new RegExp(
  '\\b(' +
    // Compound legal forms (order matters — longest first)
    's\\s*i\\s*c\\s*a\\s*v\\s*r\\s*a\\s*i\\s*f|sicavraif|' +
    's\\s*i\\s*c\\s*a\\s*v\\s*s\\s*i\\s*f|sicavsif|' +
    's\\s*i\\s*c\\s*a\\s*v|sicav|' +
    's\\s*i\\s*c\\s*a\\s*r|sicar|' +
    'r\\s*a\\s*i\\s*f|raif|' +
    // Letter-by-letter spellings common in Luxembourg names
    's\\s*c\\s*s\\s*p|scsp|' +     // SCSp / S.C.S.P.
    's\\s*c\\s*s|scs|' +            // SCS
    's\\s*c\\s*a|sca|' +            // SCA
    's\\s*a\\s*r\\s*l|sarl|' +      // SARL / S.A.R.L. / S à r l
    's\\s*a|sa|' +                  // SA / S.A.
    // Short abbreviations (only with explicit word boundaries)
    's\\s*i\\s*f|sif|' +
    'g\\s*p|gp|' +
    's\\s*v|sv' +
  ')\\b',
  'g',
);

/**
 * Normalise a legal name for comparison.
 *
 * Steps:
 *   1. Unicode-fold (NFKC) — collapses decorated + pre-composed forms.
 *   2. Lowercase.
 *   3. Strip accents (é → e, à → a) via Unicode decomposition (NFD) then
 *      removing combining marks.
 *   4. Strip all dots (so "S.C.A." → "SCA" and "S.à r.l." → "s a rl"),
 *      then non-dot punctuation → space.
 *   5. Collapse runs of short single-letter tokens ("s c a" → "sca")
 *      because legal forms are often spelled letter-by-letter.
 *   6. Strip legal-form suffixes (sa, sarl, sca, etc.).
 *   7. Collapse whitespace + trim.
 *
 * The result is the "core" name: "Avallon MBO Fund III SCA;" →
 * "avallon mbo fund iii", and "Acme S.à r.l." → "acme".
 */
export function normalizeForMatch(raw: string | null | undefined): string {
  if (!raw) return '';
  let s = raw
    .normalize('NFKC')                              // 1 — canonical form
    .toLowerCase()                                  // 2
    .normalize('NFD')                               // 3a — decompose accents
    .replace(/[\u0300-\u036f]/g, '')                // 3b — strip combining marks
    .replace(/\./g, '')                             // 4a — dots gone, preserves adjacency
    .replace(/[,;:()\-–—_/\\'"`]/g, ' ')            // 4b — other punctuation → space
    .replace(/\s+/g, ' ')                           // collapse whitespace
    .trim();
  // 5 — strip legal-form suffixes (regex handles both compact form
  // "sarl" and letter-by-letter "s a r l" produced by dot-stripping
  // "S.a.r.l." or "S.à r.l.")
  s = s.replace(LEGAL_SUFFIX_REGEX, ' ');
  // 6 — collapse + trim
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Levenshtein edit distance — O(n*m) space, standard DP. Fine for our
 * scale (single pair of names, hundreds of entities max). Returns the
 * minimum number of single-character insertions/deletions/substitutions
 * to transform `a` into `b`.
 */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  // Use two rolling rows to keep memory at O(min(n,m)).
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  const n = short.length;
  const m = long.length;
  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);
  for (let i = 0; i <= n; i += 1) prev[i] = i;
  for (let j = 1; j <= m; j += 1) {
    curr[0] = j;
    for (let i = 1; i <= n; i += 1) {
      const cost = short[i - 1] === long[j - 1] ? 0 : 1;
      curr[i] = Math.min(
        prev[i]! + 1,      // deletion
        curr[i - 1]! + 1,  // insertion
        prev[i - 1]! + cost, // substitution
      );
    }
    const tmp = prev; prev = curr; curr = tmp;
  }
  return prev[n]!;
}

/**
 * Similarity score in [0, 1]. 1 = identical after normalisation, 0 = no
 * character overlap. Undefined / empty strings → 0 (can't compare).
 *
 * Implementation: normalise both, then `1 - lev / max(len)`. Clamped to
 * [0, 1]. Short names (< 4 chars) require exact match post-normalisation
 * to count as similar (prevents "A" and "B" scoring 0.5).
 */
export function similarityScore(
  a: string | null | undefined,
  b: string | null | undefined,
): number {
  const na = normalizeForMatch(a);
  const nb = normalizeForMatch(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen < 4) return na === nb ? 1 : 0;
  const dist = levenshtein(na, nb);
  return Math.max(0, Math.min(1, 1 - dist / maxLen));
}

/**
 * Group items by near-duplicate similarity. Union-find-ish: for each
 * pair (i < j) whose score ≥ threshold, union them into a cluster.
 * Returns clusters of size ≥ 2 only (singletons are not duplicates).
 *
 * Input items expose a `name` field. Preserves the original item in
 * each cluster's `members[]` for the UI to display the full row.
 */
export function clusterDuplicates<T extends { id: string; name: string }>(
  items: T[],
  threshold = 0.85,
): Array<{ members: T[]; confidence: number }> {
  // Pre-compute normalised names once.
  const normalised = items.map(it => ({ item: it, norm: normalizeForMatch(it.name) }));
  const parent = items.map((_, idx) => idx);
  const find = (i: number): number => {
    while (parent[i]! !== i) { parent[i] = parent[parent[i]!]!; i = parent[i]!; }
    return i;
  };
  const union = (i: number, j: number) => {
    const ri = find(i); const rj = find(j);
    if (ri !== rj) parent[rj] = ri;
  };

  // Scores per cluster so we can report confidence later.
  const clusterMinScore = new Map<number, number>();

  for (let i = 0; i < normalised.length; i += 1) {
    for (let j = i + 1; j < normalised.length; j += 1) {
      const a = normalised[i]!.norm;
      const b = normalised[j]!.norm;
      if (!a || !b) continue;
      if (a === b) {
        union(i, j);
        const root = find(i);
        clusterMinScore.set(root, Math.min(clusterMinScore.get(root) ?? 1, 1));
        continue;
      }
      const maxLen = Math.max(a.length, b.length);
      if (maxLen < 4) continue;
      // Short-circuit: if edit distance floor exceeds what's allowed by
      // threshold, skip the full Levenshtein computation.
      const maxAllowedDist = Math.floor((1 - threshold) * maxLen);
      if (Math.abs(a.length - b.length) > maxAllowedDist) continue;
      const dist = levenshtein(a, b);
      const score = 1 - dist / maxLen;
      if (score >= threshold) {
        union(i, j);
        const root = find(i);
        clusterMinScore.set(root, Math.min(clusterMinScore.get(root) ?? 1, score));
      }
    }
  }

  // Collect cluster members by root.
  const buckets = new Map<number, T[]>();
  for (let i = 0; i < items.length; i += 1) {
    const root = find(i);
    if (!buckets.has(root)) buckets.set(root, []);
    buckets.get(root)!.push(items[i]!);
  }
  const out: Array<{ members: T[]; confidence: number }> = [];
  for (const [root, members] of buckets) {
    if (members.length < 2) continue;
    out.push({
      members,
      confidence: clusterMinScore.get(root) ?? 1,
    });
  }
  // Sort clusters by confidence descending so Diego tackles the easy
  // (high-confidence) ones first.
  out.sort((a, b) => b.confidence - a.confidence);
  return out;
}
