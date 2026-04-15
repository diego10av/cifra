import { NextRequest, NextResponse } from 'next/server';
import { getJob, requestCancel } from '@/lib/jobs';
import { apiError, apiFail } from '@/lib/api-errors';

// GET /api/jobs/:id  — poll for progress
// POST /api/jobs/:id/cancel — request cancellation (picked up on next loop iteration)

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const job = await getJob(id);
    if (!job) return apiError('job_not_found', 'Job not found.', { status: 404 });
    return NextResponse.json(job);
  } catch (e) { return apiFail(e, 'jobs/get'); }
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requestCancel(id);
    return NextResponse.json({ success: true });
  } catch (e) { return apiFail(e, 'jobs/cancel'); }
}
