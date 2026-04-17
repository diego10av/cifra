// ════════════════════════════════════════════════════════════════════════
// GET /api/chat/threads — list the current user's recent chat threads.
//
// Returns most-recently-updated first, archived threads excluded. Empty
// array if the chat_threads table doesn't exist (migration 001 not
// applied) — tolerant-by-design.
// ════════════════════════════════════════════════════════════════════════

import { apiOk, apiFail } from '@/lib/api-errors';
import { listThreads } from '@/lib/chat-persistence';

// Same mock used in /api/chat. Replace with real auth when multi-user lands.
const MOCK_USER_ID = 'founder';

export async function GET() {
  try {
    const threads = await listThreads(MOCK_USER_ID, { limit: 30 });
    return apiOk({ threads });
  } catch (e) {
    return apiFail(e, 'chat/threads/list');
  }
}
