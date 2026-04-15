import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';
import { createClient } from '@supabase/supabase-js';

// GET /api/documents/:id/url — returns a short-lived signed URL for previewing the file.
// Uses service-role key server-side, never exposes long-lived URLs to the client.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const doc = await queryOne('SELECT * FROM documents WHERE id = $1', [id]);
  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 10-minute signed URL — enough for preview, expires automatically
  const { data, error } = await supabase.storage
    .from('documents')
    .createSignedUrl(doc.file_path as string, 600);

  if (error || !data) {
    return NextResponse.json({ error: error?.message || 'Failed to sign URL' }, { status: 500 });
  }

  return NextResponse.json({
    url: data.signedUrl,
    filename: doc.filename,
    file_type: doc.file_type,
  });
}
