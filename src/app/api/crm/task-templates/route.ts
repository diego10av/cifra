import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET /api/crm/task-templates
// Optional ?scope=matter|company|contact filter so the detail page
// only shows relevant templates.
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const scope = url.searchParams.get('scope');

  const rows = scope
    ? await query(
        `SELECT id, name, description, scope, items
           FROM crm_task_templates
          WHERE scope = $1 OR scope = 'any'
          ORDER BY name`,
        [scope],
      )
    : await query(
        `SELECT id, name, description, scope, items
           FROM crm_task_templates
          ORDER BY scope, name`,
      );
  return NextResponse.json(rows);
}
