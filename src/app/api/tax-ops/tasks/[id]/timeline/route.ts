import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET /api/tax-ops/tasks/[id]/timeline — stint 56.B
//
// Returns the audit_log rows for a task: every status change, sign-off,
// reassignment, attachment add/remove, comment posted, etc. Anything the
// PATCH / sign / attachments endpoints have called logAudit on.
//
// Stint 84.C — engagement-aware: when called with ?include_children=1,
// the response also includes audit events for every direct sub-task and
// inlines their comment posts so the engagement detail page shows ONE
// chronological feed instead of forcing the reviewer to drill into each
// sub-task to see what's happened.
//
// Capped at 200 rows newest-first. Pagination later if needed.

interface TimelineRow {
  id: string;
  action: string;
  target_type: string;
  target_id: string;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  user_id: string | null;
  created_at: string;
  // Stint 84.C — surfaced only when include_children=1 so the UI can
  // group / link rows back to the workstream they belong to.
  subtask_id?: string | null;
  subtask_title?: string | null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const includeChildren = request.nextUrl.searchParams.get('include_children') === '1';

  if (!includeChildren) {
    const rows = await query<TimelineRow>(
      `SELECT a.id, a.action, a.target_type, a.target_id,
              a.field, a.old_value, a.new_value, a.user_id,
              a.created_at::text AS created_at
         FROM audit_log a
        WHERE a.target_type IN ('tax_ops_task', 'tax_task')
          AND a.target_id = $1
        ORDER BY a.created_at DESC
        LIMIT 200`,
      [id],
    );
    return NextResponse.json({ rows, limit: 200 });
  }

  // Engagement timeline: parent + every sub-task's audit + comment posts
  // across all of them. Comments live in tax_ops_task_comments and are
  // not in audit_log, so we UNION them in as synthetic rows so the feed
  // is genuinely complete.
  const rows = await query<TimelineRow>(
    `WITH ids AS (
       SELECT $1::text AS task_id
       UNION ALL
       SELECT id FROM tax_ops_tasks WHERE parent_task_id = $1
     ),
     subtitles AS (
       SELECT id, title FROM tax_ops_tasks WHERE id IN (SELECT task_id FROM ids)
     )
     SELECT a.id, a.action, a.target_type, a.target_id,
            a.field, a.old_value, a.new_value, a.user_id,
            a.created_at::text AS created_at,
            CASE WHEN a.target_id = $1 THEN NULL ELSE a.target_id END AS subtask_id,
            CASE WHEN a.target_id = $1 THEN NULL ELSE st.title  END AS subtask_title
       FROM audit_log a
       LEFT JOIN subtitles st ON st.id = a.target_id
      WHERE a.target_type IN ('tax_ops_task', 'tax_task')
        AND a.target_id IN (SELECT task_id FROM ids)
     UNION ALL
     SELECT c.id,
            'comment_posted'                AS action,
            'tax_ops_task'                  AS target_type,
            c.task_id                       AS target_id,
            NULL                            AS field,
            NULL                            AS old_value,
            c.body                          AS new_value,
            c.created_by                    AS user_id,
            c.created_at::text              AS created_at,
            CASE WHEN c.task_id = $1 THEN NULL ELSE c.task_id END AS subtask_id,
            CASE WHEN c.task_id = $1 THEN NULL ELSE
              (SELECT title FROM subtitles WHERE id = c.task_id)
            END                             AS subtask_title
       FROM tax_ops_task_comments c
      WHERE c.task_id IN (SELECT task_id FROM ids)
      ORDER BY created_at DESC
      LIMIT 200`,
    [id],
  );

  return NextResponse.json({ rows, limit: 200 });
}
