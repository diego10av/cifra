import { NextRequest, NextResponse } from 'next/server';
import { query, execute, generateId, logAudit } from '@/lib/db';
import { apiError } from '@/lib/api-errors';

// Matter documents are persisted as URL references (SharePoint,
// iManage, Supabase Storage, Drive). A proper multipart upload to
// Supabase Storage is possible but adds bucket-mgmt + signed-URL
// overhead; link-based covers the professional workflow today.
// Diego can drop a SharePoint URL + notes per doc and we track +
// audit the addition.

// GET — list documents attached to a matter.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const rows = await query(
    `SELECT id, matter_id, file_path, filename, kind, size_bytes,
            uploaded_by, uploaded_at, notes
       FROM crm_matter_documents
      WHERE matter_id = $1
      ORDER BY uploaded_at DESC`,
    [id],
  );
  return NextResponse.json(rows);
}

// POST — attach a new document reference to a matter.
// Body: { file_path: string (URL), filename: string, kind?, notes? }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: matterId } = await params;
  const body = await request.json().catch(() => ({}));
  const filePath = typeof body.file_path === 'string' ? body.file_path.trim() : '';
  const filename = typeof body.filename === 'string' ? body.filename.trim() : '';
  if (!filePath) return apiError('file_path_required', 'file_path (URL) is required.', { status: 400 });
  if (!filename) return apiError('filename_required', 'filename is required.', { status: 400 });

  const id = generateId();
  await execute(
    `INSERT INTO crm_matter_documents
       (id, matter_id, file_path, filename, kind, uploaded_by, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [
      id, matterId, filePath, filename,
      body.kind ?? null,
      body.uploaded_by ?? 'founder',
      body.notes ?? null,
    ],
  );

  await logAudit({
    action: 'document_attached',
    targetType: 'crm_matter',
    targetId: matterId,
    newValue: `${body.kind ?? 'document'}: ${filename}`,
    reason: 'Matter document added',
  });

  return NextResponse.json({ id, filename }, { status: 201 });
}
