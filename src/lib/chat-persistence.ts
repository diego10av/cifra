// ════════════════════════════════════════════════════════════════════════
// Chat persistence — reads + writes the chat_threads / chat_messages
// tables defined in migration 001.
//
// All operations are TOLERANT of the migration not being applied yet.
// If the tables don't exist, functions return null / [] / false and log
// a warning. The calling code (POST /api/chat) continues without
// persistence, so the chat is usable from the moment the code deploys,
// even before Diego runs the migration.
//
// Design choices:
// - Titles auto-generated from the first user message (first ~60 chars).
// - Total tokens + cost rolled up on each turn (denormalised counter so
//   the thread-list screen doesn't need a JOIN to show "€X spent").
// - Archive = soft-delete via archived_at. Lists filter it out; the
//   data stays for audit.
// ════════════════════════════════════════════════════════════════════════

import { query, execute, generateId } from '@/lib/db';
import { logger } from '@/lib/logger';

const log = logger.bind('chat-persistence');

// ─────────────────────────── types ───────────────────────────

export interface PersistedThreadSummary {
  id: string;
  user_id: string;
  title: string;
  entity_id: string | null;
  declaration_id: string | null;
  total_cost_eur: number;
  total_input_tokens: number;
  total_output_tokens: number;
  created_at: string;
  updated_at: string;
}

export interface PersistedMessage {
  id: string;
  thread_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cache_read_tokens: number | null;
  cost_eur: number | null;
  escalated_to_opus: boolean;
  created_at: string;
}

export interface PersistTurnArgs {
  /** If omitted or unknown, a new thread is created with an auto-title. */
  threadId: string | null;
  userId: string;
  userMessage: string;
  assistantMessage: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  costEur: number;
  escalatedToOpus: boolean;
  contextEntityId: string | null;
  contextDeclarationId: string | null;
}

/** Keep long user messages from becoming ugly thread titles. */
function makeTitleFromMessage(message: string): string {
  const trimmed = message.trim().replace(/\s+/g, ' ');
  if (trimmed.length <= 60) return trimmed || 'New conversation';
  return trimmed.slice(0, 57) + '…';
}

function isMissingTableError(err: unknown): boolean {
  const msg = (err as { message?: string } | null)?.message ?? '';
  return /relation ["']?chat_(threads|messages)["']? does not exist/i.test(msg);
}

// ───────────────────── persist one turn ─────────────────────

/**
 * Write a user message + assistant message to the DB in a logical
 * turn. Creates the thread on first turn. Returns the final thread id
 * (new or existing), or null if persistence failed.
 *
 * On schema-missing errors we return null and log a warning — caller
 * should continue serving the chat without persistence.
 */
export async function persistTurn(args: PersistTurnArgs): Promise<string | null> {
  try {
    let threadId = args.threadId;

    // Create thread on first turn.
    if (!threadId) {
      threadId = generateId();
      const title = makeTitleFromMessage(args.userMessage);
      await execute(
        `INSERT INTO chat_threads
           (id, user_id, title, entity_id, declaration_id,
            total_cost_eur, total_input_tokens, total_output_tokens)
         VALUES ($1, $2, $3, $4, $5, 0, 0, 0)`,
        [
          threadId,
          args.userId,
          title,
          args.contextEntityId,
          args.contextDeclarationId,
        ],
      );
    } else {
      // Validate the thread still exists and belongs to the user.
      // Prevents a stale thread_id in localStorage from writing to
      // someone else's record.
      const existing = await query<{ id: string }>(
        `SELECT id FROM chat_threads WHERE id = $1 AND user_id = $2 AND archived_at IS NULL`,
        [threadId, args.userId],
      );
      if (existing.length === 0) {
        // Thread doesn't exist / was archived / belongs to another user.
        // Create a new one silently; the UI will pick up the new id
        // on the response.
        const newId = generateId();
        const title = makeTitleFromMessage(args.userMessage);
        await execute(
          `INSERT INTO chat_threads
             (id, user_id, title, entity_id, declaration_id,
              total_cost_eur, total_input_tokens, total_output_tokens)
           VALUES ($1, $2, $3, $4, $5, 0, 0, 0)`,
          [newId, args.userId, title, args.contextEntityId, args.contextDeclarationId],
        );
        threadId = newId;
      }
    }

    // Insert user message.
    await execute(
      `INSERT INTO chat_messages
         (id, thread_id, role, content)
       VALUES ($1, $2, 'user', $3)`,
      [generateId(), threadId, args.userMessage],
    );

    // Insert assistant message.
    await execute(
      `INSERT INTO chat_messages
         (id, thread_id, role, content, model, input_tokens, output_tokens,
          cache_read_tokens, cost_eur, escalated_to_opus)
       VALUES ($1, $2, 'assistant', $3, $4, $5, $6, $7, $8, $9)`,
      [
        generateId(),
        threadId,
        args.assistantMessage,
        args.model,
        args.inputTokens,
        args.outputTokens,
        args.cacheReadTokens,
        args.costEur,
        args.escalatedToOpus,
      ],
    );

    // Roll up cumulative totals. Doing it atomically in SQL keeps the
    // denormalised counter honest even under concurrent turns.
    await execute(
      `UPDATE chat_threads
          SET total_cost_eur       = total_cost_eur + $1,
              total_input_tokens   = total_input_tokens + $2,
              total_output_tokens  = total_output_tokens + $3,
              updated_at           = NOW()
        WHERE id = $4`,
      [args.costEur, args.inputTokens, args.outputTokens, threadId],
    );

    return threadId;
  } catch (err) {
    if (isMissingTableError(err)) {
      log.warn('chat_threads / chat_messages not present — skipping persistence', {
        user_id: args.userId,
      });
    } else {
      log.error('chat turn persistence failed', err, { user_id: args.userId });
    }
    return null;
  }
}

// ─────────────────────── list / load / archive ───────────────────────

export async function listThreads(
  userId: string,
  opts: { limit?: number } = {},
): Promise<PersistedThreadSummary[]> {
  const limit = Math.min(200, Math.max(1, opts.limit ?? 30));
  try {
    const rows = await query<{
      id: string;
      user_id: string;
      title: string;
      entity_id: string | null;
      declaration_id: string | null;
      total_cost_eur: string | number;
      total_input_tokens: number;
      total_output_tokens: number;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT id, user_id, title, entity_id, declaration_id,
              total_cost_eur::text AS total_cost_eur,
              total_input_tokens, total_output_tokens,
              created_at::text AS created_at,
              updated_at::text AS updated_at
         FROM chat_threads
        WHERE user_id = $1
          AND archived_at IS NULL
        ORDER BY updated_at DESC
        LIMIT $2`,
      [userId, limit],
    );
    return rows.map(r => ({
      ...r,
      total_cost_eur: Number(r.total_cost_eur) || 0,
    }));
  } catch (err) {
    if (isMissingTableError(err)) return [];
    log.error('listThreads failed', err, { user_id: userId });
    return [];
  }
}

export async function loadThread(
  threadId: string,
  userId: string,
): Promise<{ thread: PersistedThreadSummary; messages: PersistedMessage[] } | null> {
  try {
    const threads = await query<PersistedThreadSummary & { total_cost_eur: string | number }>(
      `SELECT id, user_id, title, entity_id, declaration_id,
              total_cost_eur::float AS total_cost_eur,
              total_input_tokens, total_output_tokens,
              created_at::text AS created_at,
              updated_at::text AS updated_at
         FROM chat_threads
        WHERE id = $1 AND user_id = $2 AND archived_at IS NULL`,
      [threadId, userId],
    );
    const thread = threads[0];
    if (!thread) return null;

    const messages = await query<PersistedMessage & { cost_eur: string | number | null }>(
      `SELECT id, thread_id, role, content, model,
              input_tokens, output_tokens, cache_read_tokens,
              cost_eur::float AS cost_eur, escalated_to_opus,
              created_at::text AS created_at
         FROM chat_messages
        WHERE thread_id = $1
        ORDER BY created_at ASC`,
      [threadId],
    );

    return {
      thread: { ...thread, total_cost_eur: Number(thread.total_cost_eur) || 0 },
      messages: messages.map(m => ({ ...m, cost_eur: m.cost_eur === null ? null : Number(m.cost_eur) })),
    };
  } catch (err) {
    if (isMissingTableError(err)) return null;
    log.error('loadThread failed', err, { thread_id: threadId });
    return null;
  }
}

export async function archiveThread(threadId: string, userId: string): Promise<boolean> {
  try {
    const result = await query(
      `UPDATE chat_threads SET archived_at = NOW()
        WHERE id = $1 AND user_id = $2 AND archived_at IS NULL
        RETURNING id`,
      [threadId, userId],
    );
    return result.length > 0;
  } catch (err) {
    if (isMissingTableError(err)) return false;
    log.error('archiveThread failed', err, { thread_id: threadId });
    return false;
  }
}

export async function renameThread(
  threadId: string,
  userId: string,
  title: string,
): Promise<boolean> {
  const safe = title.trim().slice(0, 200);
  if (!safe) return false;
  try {
    const result = await query(
      `UPDATE chat_threads SET title = $1
        WHERE id = $2 AND user_id = $3 AND archived_at IS NULL
        RETURNING id`,
      [safe, threadId, userId],
    );
    return result.length > 0;
  } catch (err) {
    if (isMissingTableError(err)) return false;
    log.error('renameThread failed', err, { thread_id: threadId });
    return false;
  }
}

// Exported for unit tests
export const __testing = { makeTitleFromMessage, isMissingTableError };
