// GET /api/clients/[id]/preview-delete
//
// Returns the cascade-delete blast radius for a client: counts of
// entities / declarations / invoices / etc. that would be removed
// if the reviewer confirms a permanent delete. Shown in the
// confirm-modal on /clients/[id].

import { NextRequest } from 'next/server';
import { apiError, apiOk, apiFail } from '@/lib/api-errors';
import { previewClientDelete, summarisePreview } from '@/lib/cascade-delete';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const preview = await previewClientDelete(id);
    if (!preview) return apiError('not_found', 'Client not found.', { status: 404 });
    return apiOk({ preview, summary: summarisePreview(preview) });
  } catch (err) {
    return apiFail(err, 'clients/preview-delete');
  }
}
