import { describe, it, expect } from 'vitest';
import { apiError, apiOk, apiFail } from '@/lib/api-errors';

describe('apiError', () => {
  it('wraps code + message in the standard envelope', async () => {
    const res = apiError('not_found', 'missing thing');
    expect(res.status).toBe(400);
    const body = await res.json() as { error: { code: string; message: string } };
    expect(body.error.code).toBe('not_found');
    expect(body.error.message).toBe('missing thing');
  });

  it('respects the status override', () => {
    const res = apiError('not_found', 'x', { status: 404 });
    expect(res.status).toBe(404);
  });

  it('carries the hint when provided', async () => {
    const res = apiError('c', 'm', { hint: 'try reloading' });
    const body = await res.json() as { error: { hint: string } };
    expect(body.error.hint).toBe('try reloading');
  });
});

describe('apiOk', () => {
  it('returns 200 with the body passed through', async () => {
    const res = apiOk({ id: 'abc', count: 7 });
    expect(res.status).toBe(200);
    const body = await res.json() as { id: string; count: number };
    expect(body.id).toBe('abc');
    expect(body.count).toBe(7);
  });

  it('respects a status override', () => {
    const res = apiOk({ ok: true }, 201);
    expect(res.status).toBe(201);
  });
});

describe('apiFail', () => {
  it('uses 500 by default', async () => {
    const res = apiFail(new Error('boom'), 'some/route');
    expect(res.status).toBe(500);
    const body = await res.json() as { error: { code: string; message: string } };
    expect(body.error.code).toBe('internal_error');
    expect(body.error.message).toBe('boom');
  });

  it('respects a custom status code on the error', async () => {
    const err = Object.assign(new Error('unauthorized'), { status: 401 });
    const res = apiFail(err, 'some/route');
    expect(res.status).toBe(401);
  });

  it('surfaces a custom err.code in the envelope', async () => {
    const err = Object.assign(new Error('x'), { code: 'custom_code' });
    const res = apiFail(err, 'some/route');
    const body = await res.json() as { error: { code: string } };
    expect(body.error.code).toBe('custom_code');
  });

  it('handles non-Error values without crashing', async () => {
    const res = apiFail('just a string', 'some/route');
    expect(res.status).toBe(500);
  });
});
