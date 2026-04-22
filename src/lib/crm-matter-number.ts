// ════════════════════════════════════════════════════════════════════════
// crm-matter-number — generate the next MP-YYYY-NNNN matter reference.
//
// Scheme: "MP" (Manso Partners) + year + 4-digit sequence, unique.
// Sequence resets per year. Race-safe via UPDATE ... RETURNING pattern
// — we count existing rows with that year prefix and add 1.
//
// The UNIQUE constraint on crm_matters.matter_reference plus this
// one-call counter is enough for single-writer volume (dozens of
// matters/year). If volume ever grows to >1 matter/minute a sequence
// counter table would be better, but that's out of scope today.
// ════════════════════════════════════════════════════════════════════════

import { query } from '@/lib/db';

export async function nextMatterReference(prefix: string = 'MP'): Promise<string> {
  const year = new Date().getFullYear();
  const like = `${prefix}-${year}-%`;
  const rows = await query<{ max_seq: string | null }>(
    `SELECT MAX(CAST(SPLIT_PART(matter_reference, '-', 3) AS integer))::text AS max_seq
       FROM crm_matters
      WHERE matter_reference LIKE $1
        AND matter_reference ~ ('^' || $2 || '-[0-9]{4}-[0-9]+$')`,
    [like, prefix + '-' + year],
  );
  const last = Number(rows[0]?.max_seq ?? 0);
  const next = last + 1;
  return `${prefix}-${year}-${String(next).padStart(4, '0')}`;
}
