import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hermetic: mock out all DB access. The persistence module is pure
// SQL-orchestration on top of query/execute/generateId.
vi.mock('@/lib/db', () => ({
  query: vi.fn(),
  execute: vi.fn(),
  generateId: vi.fn(() => 'test-id-' + Math.random().toString(36).slice(2, 8)),
}));

import { query, execute } from '@/lib/db';
import {
  persistTurn,
  listThreads,
  loadThread,
  archiveThread,
  renameThread,
  __testing,
} from '@/lib/chat-persistence';

const mockQuery = query as unknown as ReturnType<typeof vi.fn>;
const mockExecute = execute as unknown as ReturnType<typeof vi.fn>;

describe('makeTitleFromMessage', () => {
  const { makeTitleFromMessage } = __testing;

  it('returns trimmed message when ≤ 60 chars', () => {
    expect(makeTitleFromMessage('Explain RULE 4')).toBe('Explain RULE 4');
  });

  it('collapses whitespace', () => {
    expect(makeTitleFromMessage('  hi   there  ')).toBe('hi there');
  });

  it('truncates + ellipsises longer text', () => {
    const long = 'a'.repeat(80);
    const title = makeTitleFromMessage(long);
    expect(title.length).toBeLessThanOrEqual(60);
    expect(title.endsWith('…')).toBe(true);
  });

  it('falls back to "New conversation" on empty input', () => {
    expect(makeTitleFromMessage('')).toBe('New conversation');
    expect(makeTitleFromMessage('   ')).toBe('New conversation');
  });
});

describe('isMissingTableError', () => {
  const { isMissingTableError } = __testing;

  it('matches the canonical Postgres error wording', () => {
    expect(isMissingTableError(new Error(`relation "chat_threads" does not exist`))).toBe(true);
    expect(isMissingTableError(new Error(`relation chat_messages does not exist`))).toBe(true);
  });

  it('does not match unrelated errors', () => {
    expect(isMissingTableError(new Error('connection refused'))).toBe(false);
    expect(isMissingTableError(new Error('syntax error'))).toBe(false);
  });

  it('tolerates non-Error values', () => {
    expect(isMissingTableError(null)).toBe(false);
    expect(isMissingTableError('plain string')).toBe(false);
  });
});

describe('persistTurn', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockExecute.mockReset();
  });

  const baseArgs = {
    threadId: null as string | null,
    userId: 'founder',
    userMessage: 'Hello',
    assistantMessage: 'Hi, how can I help?',
    model: 'claude-haiku-4-5-20251001',
    inputTokens: 120,
    outputTokens: 40,
    cacheReadTokens: 0,
    costEur: 0.005,
    escalatedToOpus: false,
    contextEntityId: null,
    contextDeclarationId: null,
  };

  it('creates a new thread + inserts both messages + rolls up totals', async () => {
    mockExecute.mockResolvedValue(undefined);
    mockQuery.mockResolvedValue([]); // thread validation: no existing thread

    const id = await persistTurn({ ...baseArgs, threadId: null });

    expect(id).toBeTruthy();
    expect(id!.startsWith('test-id-')).toBe(true);
    // INSERT thread + INSERT user msg + INSERT assistant msg + UPDATE totals
    expect(mockExecute).toHaveBeenCalledTimes(4);

    const calls = mockExecute.mock.calls.map((c) => c[0] as string);
    expect(calls[0]).toMatch(/INSERT INTO chat_threads/);
    expect(calls[1]).toMatch(/INSERT INTO chat_messages/);
    expect(calls[2]).toMatch(/INSERT INTO chat_messages/);
    expect(calls[3]).toMatch(/UPDATE chat_threads/);
  });

  it('reuses an existing thread when it exists for the user', async () => {
    mockExecute.mockResolvedValue(undefined);
    mockQuery.mockResolvedValueOnce([{ id: 'thr-abc' }]); // thread exists

    const id = await persistTurn({ ...baseArgs, threadId: 'thr-abc' });

    expect(id).toBe('thr-abc');
    // INSERT user + INSERT assistant + UPDATE totals (no new thread insert)
    expect(mockExecute).toHaveBeenCalledTimes(3);
  });

  it('swaps to a fresh thread if the inbound id is stale / not owned by user', async () => {
    mockExecute.mockResolvedValue(undefined);
    mockQuery.mockResolvedValueOnce([]); // thread lookup: empty

    const id = await persistTurn({ ...baseArgs, threadId: 'stale-id' });

    expect(id).not.toBe('stale-id');
    expect(id!.startsWith('test-id-')).toBe(true);
    // INSERT new thread + INSERT user msg + INSERT assistant msg + UPDATE totals
    expect(mockExecute).toHaveBeenCalledTimes(4);
  });

  it('returns null when the chat_threads table is missing (tolerant)', async () => {
    mockExecute.mockRejectedValueOnce(new Error('relation "chat_threads" does not exist'));

    const id = await persistTurn({ ...baseArgs });
    expect(id).toBe(null);
  });

  it('returns null on unexpected DB errors (tolerant)', async () => {
    mockExecute.mockRejectedValueOnce(new Error('random crash'));
    const id = await persistTurn({ ...baseArgs });
    expect(id).toBe(null);
  });
});

describe('listThreads', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('returns normalised rows with numeric total_cost_eur', async () => {
    mockQuery.mockResolvedValueOnce([
      {
        id: 't1', user_id: 'founder', title: 'Title 1',
        entity_id: null, declaration_id: null,
        total_cost_eur: '0.42',
        total_input_tokens: 100, total_output_tokens: 50,
        created_at: '2026-04-17T10:00:00Z', updated_at: '2026-04-18T08:00:00Z',
      },
    ]);

    const threads = await listThreads('founder');
    expect(threads).toHaveLength(1);
    expect(threads[0]!.total_cost_eur).toBe(0.42);
  });

  it('returns empty array when chat_threads table missing', async () => {
    mockQuery.mockRejectedValueOnce(new Error(`relation "chat_threads" does not exist`));
    const threads = await listThreads('founder');
    expect(threads).toEqual([]);
  });

  it('clamps limit to [1, 200]', async () => {
    mockQuery.mockResolvedValueOnce([]);
    await listThreads('founder', { limit: 999 });
    const params = mockQuery.mock.calls[0]![1] as unknown[];
    expect(params[1]).toBe(200);
  });
});

describe('loadThread', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('returns null when thread is not found for this user', async () => {
    mockQuery.mockResolvedValueOnce([]); // thread query
    const data = await loadThread('missing', 'founder');
    expect(data).toBe(null);
  });

  it('returns thread + messages when found', async () => {
    mockQuery
      .mockResolvedValueOnce([
        {
          id: 't1', user_id: 'founder', title: 'chat',
          entity_id: null, declaration_id: null,
          total_cost_eur: 0.3,
          total_input_tokens: 0, total_output_tokens: 0,
          created_at: 'x', updated_at: 'x',
        },
      ])
      .mockResolvedValueOnce([
        { id: 'm1', thread_id: 't1', role: 'user', content: 'hi', model: null,
          input_tokens: null, output_tokens: null, cache_read_tokens: null,
          cost_eur: null, escalated_to_opus: false, created_at: 'x' },
        { id: 'm2', thread_id: 't1', role: 'assistant', content: 'hello', model: 'haiku',
          input_tokens: 10, output_tokens: 5, cache_read_tokens: 0,
          cost_eur: '0.01', escalated_to_opus: false, created_at: 'x' },
      ]);

    const data = await loadThread('t1', 'founder');
    expect(data).not.toBeNull();
    expect(data!.thread.id).toBe('t1');
    expect(data!.messages).toHaveLength(2);
    expect(data!.messages[1]!.cost_eur).toBe(0.01); // numeric
  });
});

describe('archiveThread', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('returns true when a row was archived', async () => {
    mockQuery.mockResolvedValueOnce([{ id: 't1' }]);
    expect(await archiveThread('t1', 'founder')).toBe(true);
  });

  it('returns false when nothing was affected', async () => {
    mockQuery.mockResolvedValueOnce([]);
    expect(await archiveThread('ghost', 'founder')).toBe(false);
  });

  it('returns false on missing table', async () => {
    mockQuery.mockRejectedValueOnce(new Error(`relation "chat_threads" does not exist`));
    expect(await archiveThread('t1', 'founder')).toBe(false);
  });
});

describe('renameThread', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('rejects empty titles', async () => {
    expect(await renameThread('t1', 'founder', '   ')).toBe(false);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('trims and truncates to 200 chars', async () => {
    mockQuery.mockResolvedValueOnce([{ id: 't1' }]);
    const long = ' '.repeat(10) + 'a'.repeat(500) + '  ';
    await renameThread('t1', 'founder', long);
    const params = mockQuery.mock.calls[0]![1] as unknown[];
    expect((params[0] as string).length).toBeLessThanOrEqual(200);
    expect((params[0] as string).startsWith(' ')).toBe(false);
  });
});
