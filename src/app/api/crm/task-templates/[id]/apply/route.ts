import { NextRequest, NextResponse } from 'next/server';
import { queryOne, execute, generateId, logAudit } from '@/lib/db';
import { apiError } from '@/lib/api-errors';

// POST /api/crm/task-templates/[id]/apply
// Body: { target_type: 'crm_matter'|'crm_company'|'crm_contact', target_id: string }
//
// For each item in the template, create one crm_tasks row with
// due_date = today + due_offset_days, related_type/id pointing at
// the target. Returns the list of created task ids for the UI to
// show "7 tasks created" and link to the tasks tab.
interface TemplateItem {
  title: string;
  description?: string;
  due_offset_days?: number;
  priority?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: templateId } = await params;
  const body = await request.json().catch(() => ({}));
  const targetType = typeof body.target_type === 'string' ? body.target_type : '';
  const targetId = typeof body.target_id === 'string' ? body.target_id : '';
  if (!targetType || !targetId) {
    return apiError('target_required', 'target_type and target_id are required.', { status: 400 });
  }

  const template = await queryOne<{ id: string; name: string; items: TemplateItem[] }>(
    `SELECT id, name, items FROM crm_task_templates WHERE id = $1`,
    [templateId],
  );
  if (!template) return apiError('not_found', 'Template not found.', { status: 404 });

  const items = Array.isArray(template.items) ? template.items : [];
  const today = new Date();
  const created: string[] = [];

  for (const item of items) {
    const offset = typeof item.due_offset_days === 'number' ? item.due_offset_days : 0;
    const due = new Date(today.getTime() + offset * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const priority = item.priority === 'high' || item.priority === 'low' || item.priority === 'medium'
      ? item.priority : 'medium';
    const taskId = generateId();
    await execute(
      `INSERT INTO crm_tasks
         (id, title, description, related_type, related_id, status,
          priority, due_date, auto_generated, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,'open',$6,$7,TRUE,NOW(),NOW())`,
      [
        taskId, item.title, item.description ?? null,
        targetType, targetId,
        priority, due,
      ],
    );
    created.push(taskId);
  }

  await logAudit({
    action: 'template_applied',
    targetType,
    targetId,
    field: 'task_template',
    newValue: templateId,
    reason: `Applied template "${template.name}" — ${created.length} tasks created`,
  });

  return NextResponse.json({
    template_id: templateId,
    template_name: template.name,
    tasks_created: created.length,
    task_ids: created,
  });
}
