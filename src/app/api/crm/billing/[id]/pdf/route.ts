import { NextRequest, NextResponse } from 'next/server';
import { buildInvoicePDF } from '@/lib/crm-invoice-pdf';
import { apiError } from '@/lib/api-errors';
import { logAudit } from '@/lib/db';

// GET /api/crm/billing/[id]/pdf — stream a branded invoice PDF.
// Inline by default (?download=1 forces an attachment disposition).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(request.url);
  const download = url.searchParams.get('download') === '1';

  try {
    const { buffer, filename } = await buildInvoicePDF(id);
    await logAudit({
      action: 'export',
      targetType: 'crm_invoice',
      targetId: id,
      field: 'pdf',
      reason: `Invoice PDF generated (${filename})`,
    });
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': String(buffer.byteLength),
        'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'PDF generation failed';
    if (msg === 'Invoice not found') {
      return apiError('not_found', msg, { status: 404 });
    }
    return apiError('pdf_failed', msg, { status: 500 });
  }
}
