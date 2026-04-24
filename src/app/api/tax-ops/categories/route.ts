import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET /api/tax-ops/categories
//   Returns the sidebar-visible tax_deadline_rules ordered by
//   sidebar_order, with metadata the client needs to build the
//   Tax-Ops sub-nav dynamically.
//
// Falls back silently (empty array) if the DB is unreachable so the
// sidebar can still render the home/tasks/entities/settings items.

interface SidebarCategory {
  tax_type: string;
  period_pattern: string;
  sidebar_label: string;
  sidebar_icon: string | null;
  sidebar_group: string | null;
  sidebar_order: number;
}

export async function GET() {
  try {
    const rows = await query<SidebarCategory>(
      `SELECT tax_type, period_pattern,
              COALESCE(sidebar_label, tax_type) AS sidebar_label,
              sidebar_icon,
              sidebar_group,
              sidebar_order
         FROM tax_deadline_rules
        WHERE sidebar_visible = TRUE
        ORDER BY sidebar_order ASC, sidebar_label ASC`,
    );
    return NextResponse.json({ categories: rows });
  } catch (err) {
    return NextResponse.json({ categories: [], error: String(err instanceof Error ? err.message : err) }, { status: 200 });
  }
}
