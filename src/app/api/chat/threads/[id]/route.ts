// ════════════════════════════════════════════════════════════════════════
// GET    /api/chat/threads/[id] — load a thread + all its messages
// DELETE /api/chat/threads/[id] — archive (soft-delete)
// PATCH  /api/chat/threads/[id] — rename (body: { title })
//
// 404 if the thread doesn't belong to the current user (same shape as
// "not found" so we don't leak existence of other users' threads).
// ════════════════════════════════════════════════════════════════════════

import { NextRequest } from 'next/server';
import { apiError, apiOk, apiFail } from '@/lib/api-errors';
import { loadThread, archiveThread, renameThread } from '@/lib/chat-persistence';

const MOCK_USER_ID = 'founder';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const data = await loadThread(id, MOCK_USER_ID);
    if (!data) {
      return apiError('thread_not_found', 'Conversation not found.', { status: 404 });
    }
    return apiOk({ thread: data.thread, messages: data.messages });
  } catch (e) {
    return apiFail(e, 'chat/threads/get');
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const ok = await archiveThread(id, MOCK_USER_ID);
    if (!ok) {
      return apiError('thread_not_found', 'Conversation not found or already archived.', { status: 404 });
    }
    return apiOk({ archived: true });
  } catch (e) {
    return apiFail(e, 'chat/threads/delete');
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { title?: string };
    if (typeof body.title !== 'string' || body.title.trim().length === 0) {
      return apiError('bad_title', 'title must be a non-empty string.', { status: 400 });
    }
    const ok = await renameThread(id, MOCK_USER_ID, body.title);
    if (!ok) {
      return apiError('thread_not_found', 'Conversation not found.', { status: 404 });
    }
    return apiOk({ renamed: true });
  } catch (e) {
    return apiFail(e, 'chat/threads/rename');
  }
}
