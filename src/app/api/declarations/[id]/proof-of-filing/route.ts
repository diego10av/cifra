import { NextRequest, NextResponse } from 'next/server';
import { queryOne, execute, logAudit } from '@/lib/db';
import { createClient } from '@supabase/supabase-js';

// POST: upload proof-of-filing PDF/image. Stored in Supabase Storage
// under proof-of-filing/<declaration_id>/<filename>. Returns nothing fancy —
// the GET below returns a signed URL for preview.
//
// GET: returns a short-lived signed URL for the stored proof.

function supabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const BUCKET = 'documents';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'file is required' }, { status: 400 });

  const decl = await queryOne<{ entity_id: string; status: string; proof_of_filing_path: string | null }>(
    'SELECT entity_id, status, proof_of_filing_path FROM declarations WHERE id = $1',
    [id]
  );
  if (!decl) return NextResponse.json({ error: 'Declaration not found' }, { status: 404 });
  if (!['filed', 'paid'].includes(decl.status)) {
    return NextResponse.json({ error: 'Declaration must be filed or paid before uploading proof' }, { status: 400 });
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `proof-of-filing/${id}/${Date.now()}_${safeName}`;
  const bytes = await file.arrayBuffer();
  const sb = supabase();

  // Replace any previous proof for this declaration
  if (decl.proof_of_filing_path) {
    await sb.storage.from(BUCKET).remove([decl.proof_of_filing_path]);
  }
  const { error: upErr } = await sb.storage.from(BUCKET).upload(storagePath, Buffer.from(bytes), {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  await execute(
    `UPDATE declarations
        SET proof_of_filing_path = $1,
            proof_of_filing_filename = $2,
            proof_of_filing_uploaded_at = NOW(),
            updated_at = NOW()
      WHERE id = $3`,
    [storagePath, file.name, id]
  );

  await logAudit({
    entityId: decl.entity_id, declarationId: id,
    action: 'update', targetType: 'declaration', targetId: id,
    field: 'proof_of_filing', oldValue: decl.proof_of_filing_path || '',
    newValue: file.name,
  });

  return NextResponse.json({ success: true, filename: file.name });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const decl = await queryOne<{ proof_of_filing_path: string | null; proof_of_filing_filename: string | null }>(
    'SELECT proof_of_filing_path, proof_of_filing_filename FROM declarations WHERE id = $1',
    [id]
  );
  if (!decl?.proof_of_filing_path) {
    return NextResponse.json({ error: 'No proof-of-filing uploaded' }, { status: 404 });
  }
  const { data, error } = await supabase().storage.from(BUCKET).createSignedUrl(decl.proof_of_filing_path, 600);
  if (error || !data) return NextResponse.json({ error: error?.message || 'Failed to sign URL' }, { status: 500 });
  return NextResponse.json({ url: data.signedUrl, filename: decl.proof_of_filing_filename });
}
