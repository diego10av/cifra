// GET /api/entities/[id]/preview-delete — cascade blast-radius preview.

import { NextRequest } from 'next/server';
import { apiError, apiOk, apiFail } from '@/lib/api-errors';
import { previewEntityDelete, summarisePreview } from '@/lib/cascade-delete';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const preview = await previewEntityDelete(id);
    if (!preview) return apiError('not_found', 'Entity not found.', { status: 404 });
    return apiOk({ preview, summary: summarisePreview(preview) });
  } catch (err) {
    return apiFail(err, 'entities/preview-delete');
  }
}
