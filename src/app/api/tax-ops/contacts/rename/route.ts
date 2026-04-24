import { NextRequest, NextResponse } from 'next/server';
import { tx, qTx, execTx, logAuditTx } from '@/lib/db';

// POST /api/tax-ops/contacts/rename?dry_run=1
//
// Stint 42.B — propagate a contact edit (email / name / role change)
// across every `tax_entities.csp_contacts` and `tax_filings.csp_contacts`
// row that references the old email.
//
// Body:
//   {
//     old_email:  string (required, case-insensitive match via lower+trim)
//     new_email?: string (optional)
//     new_name?:  string (optional)
//     new_role?:  string (optional)
//   }
//
// Atomicity: one transaction covering both table updates. Dry-run mode
// (`?dry_run=1`) returns the would-affect counts without mutating —
// used by the UI's "Preview changes" button before Diego hits Apply.

interface Body {
  old_email?: unknown;
  new_email?: unknown;
  new_name?: unknown;
  new_role?: unknown;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url);
  const dryRun = url.searchParams.get('dry_run') === '1';
  const body = await request.json() as Body;

  const oldEmail = typeof body.old_email === 'string' ? body.old_email.trim() : '';
  const newEmail = typeof body.new_email === 'string' ? body.new_email.trim() : null;
  const newName  = typeof body.new_name  === 'string' ? body.new_name.trim()  : null;
  const newRole  = typeof body.new_role  === 'string' ? body.new_role.trim()  : null;

  if (!oldEmail) {
    return NextResponse.json({ error: 'old_email is required' }, { status: 400 });
  }
  if (newEmail === null && newName === null && newRole === null) {
    return NextResponse.json(
      { error: 'at least one of new_email / new_name / new_role must be provided' },
      { status: 400 },
    );
  }

  const emailNorm = oldEmail.toLowerCase();

  try {
    const result = await tx(async (client) => {
      // Count affected first (for both dry_run and audit log).
      const entityHits = await qTx<{ n: string }>(
        client,
        `SELECT COUNT(*)::text AS n FROM tax_entities
           WHERE EXISTS (
             SELECT 1 FROM jsonb_array_elements(COALESCE(csp_contacts, '[]'::jsonb)) c
             WHERE LOWER(TRIM(c->>'email')) = $1
           )`,
        [emailNorm],
      );
      const filingHits = await qTx<{ n: string }>(
        client,
        `SELECT COUNT(*)::text AS n FROM tax_filings
           WHERE EXISTS (
             SELECT 1 FROM jsonb_array_elements(COALESCE(csp_contacts, '[]'::jsonb)) c
             WHERE LOWER(TRIM(c->>'email')) = $1
           )`,
        [emailNorm],
      );
      const entityCount = Number(entityHits[0]?.n ?? 0);
      const filingCount = Number(filingHits[0]?.n ?? 0);

      if (dryRun) {
        return {
          dry_run: true,
          entity_rows_affected: entityCount,
          filing_rows_affected: filingCount,
        };
      }

      // Mutate: rewrite each matching array element with the patched
      // object. The strategy is "rebuild the array": jsonb_array_elements
      // flattens, CASE patches the target, jsonb_agg reassembles.
      const patchSql = `
        COALESCE((
          SELECT jsonb_agg(
            CASE
              WHEN LOWER(TRIM(c->>'email')) = $2
              THEN c
                || CASE WHEN $3::text IS NOT NULL THEN jsonb_build_object('email', $3::text) ELSE '{}'::jsonb END
                || CASE WHEN $4::text IS NOT NULL THEN jsonb_build_object('name',  $4::text) ELSE '{}'::jsonb END
                || CASE WHEN $5::text IS NOT NULL THEN jsonb_build_object('role',  $5::text) ELSE '{}'::jsonb END
              ELSE c
            END
          )
          FROM jsonb_array_elements(COALESCE(csp_contacts, '[]'::jsonb)) c
        ), '[]'::jsonb)
      `;

      await execTx(
        client,
        `UPDATE tax_entities
            SET csp_contacts = ${patchSql},
                updated_at = NOW()
          WHERE EXISTS (
            SELECT 1 FROM jsonb_array_elements(COALESCE(csp_contacts, '[]'::jsonb)) c
            WHERE LOWER(TRIM(c->>'email')) = $1
          )`,
        [emailNorm, emailNorm, newEmail, newName, newRole],
      );
      await execTx(
        client,
        `UPDATE tax_filings
            SET csp_contacts = ${patchSql},
                updated_at = NOW()
          WHERE EXISTS (
            SELECT 1 FROM jsonb_array_elements(COALESCE(csp_contacts, '[]'::jsonb)) c
            WHERE LOWER(TRIM(c->>'email')) = $1
          )`,
        [emailNorm, emailNorm, newEmail, newName, newRole],
      );

      await logAuditTx(client, {
        userId: 'founder',
        action: 'tax_contact_bulk_rename',
        targetType: 'tax_contact',
        targetId: emailNorm,
        newValue: JSON.stringify({
          old_email: emailNorm,
          new_email: newEmail,
          new_name: newName,
          new_role: newRole,
          entity_rows_affected: entityCount,
          filing_rows_affected: filingCount,
        }),
      });

      return {
        dry_run: false,
        entity_rows_affected: entityCount,
        filing_rows_affected: filingCount,
      };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = String(e instanceof Error ? e.message : e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
