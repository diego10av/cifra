import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';
import { computeECDF } from '@/lib/ecdf';
import { generatePaymentReference } from '@/lib/payment-ref';

// GET /api/declarations/:id/outputs
// Returns the computed eCDF box values, totals, and payment instructions.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const decl = await queryOne<{
      year: number; period: string; status: string;
      matricule: string | null; entity_name: string;
    }>(
      `SELECT d.year, d.period, d.status, e.matricule, e.name as entity_name
         FROM declarations d JOIN entities e ON d.entity_id = e.id
        WHERE d.id = $1`,
      [id]
    );
    if (!decl) return NextResponse.json({ error: 'Declaration not found' }, { status: 404 });

    const ecdf = await computeECDF(id);

    let payment = null;
    let paymentError: string | null = null;
    try {
      payment = generatePaymentReference({
        matricule: decl.matricule,
        year: decl.year,
        period: decl.period,
        amount: ecdf.totals.payable,
      });
    } catch (e) {
      paymentError = e instanceof Error ? e.message : String(e);
    }

    return NextResponse.json({
      ecdf,
      payment,
      payment_error: paymentError,
      declaration: {
        year: decl.year,
        period: decl.period,
        status: decl.status,
        entity_name: decl.entity_name,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
