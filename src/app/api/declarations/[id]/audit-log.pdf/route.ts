// ════════════════════════════════════════════════════════════════════════
// GET /api/declarations/[id]/audit-log.pdf
//
// Returns a PDF of the declaration's audit trail — the "compliance
// paper trail" document a reviewer can attach to a case file or send
// to an auditor on request. See src/lib/audit-trail-pdf.ts for the
// actual layout + rendering.
//
// Intentionally a GET so the "Export PDF" button in the UI is a plain
// <a href target="_blank"> and the browser handles download naturally
// (no fetch dance, no Blob URL).
// ════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { buildAuditTrailPDF } from '@/lib/audit-trail-pdf';
import { apiFail } from '@/lib/api-errors';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { buffer, filename } = await buildAuditTrailPDF(id);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err) {
    return apiFail(err, 'declaration/audit-log.pdf');
  }
}
