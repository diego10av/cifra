import { NextRequest, NextResponse } from 'next/server';
import { query, execute, logAudit } from '@/lib/db';
import { apiError } from '@/lib/api-errors';

// The canonical 7-step closing checklist. Lazy-populated on first GET
// so new matters don't need a trigger or seeding migration.
const CANONICAL_STEPS = [
  'conflict_final_check',
  'engagement_letter_archived',
  'closing_letter_sent',
  'final_invoice_sent',
  'files_archived',
  'research_saved',
  'time_reconciled',
] as const;

export const STEP_LABELS: Record<string, string> = {
  conflict_final_check:       'Final conflict check done',
  engagement_letter_archived: 'Engagement letter archived',
  closing_letter_sent:        'Closing letter sent to client',
  final_invoice_sent:         'Final invoice sent',
  files_archived:             'Files archived',
  research_saved:              'Research artifacts saved',
  time_reconciled:            'All time entries reconciled',
};

// GET — return closing steps for the matter, creating missing ones.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  // Ensure all canonical steps exist.
  for (const stepName of CANONICAL_STEPS) {
    await execute(
      `INSERT INTO crm_matter_closing_steps (matter_id, step_name)
       VALUES ($1, $2) ON CONFLICT (matter_id, step_name) DO NOTHING`,
      [id, stepName],
    );
  }
  const rows = await query<{ step_name: string; completed: boolean; completed_at: string | null; completed_by: string | null; notes: string | null }>(
    `SELECT step_name, completed, completed_at, completed_by, notes
       FROM crm_matter_closing_steps
      WHERE matter_id = $1
      ORDER BY ARRAY_POSITION(ARRAY[${CANONICAL_STEPS.map((_, i) => `'${CANONICAL_STEPS[i]}'`).join(',')}]::text[], step_name)`,
    [id],
  );

  return NextResponse.json(
    rows.map(r => ({ ...r, label: STEP_LABELS[r.step_name] ?? r.step_name })),
  );
}

// PUT — flip a step's completed state.
// Body: { step_name, completed, notes? }
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: matterId } = await params;
  const body = await request.json().catch(() => ({}));
  const stepName = body.step_name;
  if (!stepName || typeof stepName !== 'string') {
    return apiError('step_name_required', 'step_name is required.', { status: 400 });
  }
  const completed = !!body.completed;

  await execute(
    `INSERT INTO crm_matter_closing_steps (matter_id, step_name, completed, completed_at, completed_by, notes)
     VALUES ($1, $2, $3, CASE WHEN $3 THEN NOW() ELSE NULL END, CASE WHEN $3 THEN $4 ELSE NULL END, $5)
     ON CONFLICT (matter_id, step_name) DO UPDATE SET
       completed = EXCLUDED.completed,
       completed_at = EXCLUDED.completed_at,
       completed_by = EXCLUDED.completed_by,
       notes = COALESCE(EXCLUDED.notes, crm_matter_closing_steps.notes)`,
    [matterId, stepName, completed, body.completed_by ?? 'founder', body.notes ?? null],
  );

  await logAudit({
    action: 'closing_step_updated',
    targetType: 'crm_matter',
    targetId: matterId,
    field: stepName,
    newValue: completed ? 'completed' : 'pending',
    reason: `Closing checklist: ${STEP_LABELS[stepName] ?? stepName}`,
  });

  return NextResponse.json({ matter_id: matterId, step_name: stepName, completed });
}
