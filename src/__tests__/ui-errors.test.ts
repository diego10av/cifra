import { describe, it, expect } from 'vitest';
import { describeApiError, formatUiError } from '@/lib/ui-errors';

function makeJsonResponse(body: unknown, status = 400): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('describeApiError', () => {
  it('reads the { error: { code, message, hint } } envelope', async () => {
    const res = makeJsonResponse({
      error: { code: 'not_found', message: 'Entity missing', hint: 'Create one first.' },
    }, 404);
    const ui = await describeApiError(res);
    expect(ui.code).toBe('not_found');
    expect(ui.message).toBe('Entity missing');
    expect(ui.hint).toBe('Create one first.');
  });

  it('supports a string-shaped error field', async () => {
    const res = makeJsonResponse({ error: 'just a plain string' }, 400);
    const ui = await describeApiError(res);
    expect(ui.message).toBe('just a plain string');
    expect(ui.code).toBe('http_400');
  });

  it('falls back to http_{status} when no code is provided', async () => {
    const res = makeJsonResponse({ error: { message: 'Boom' } }, 500);
    const ui = await describeApiError(res);
    expect(ui.code).toBe('http_500');
    expect(ui.message).toBe('Boom');
  });

  it('uses the fallback string when body is not JSON', async () => {
    const res = new Response('<!doctype html><html>…</html>', {
      status: 502,
      headers: { 'Content-Type': 'text/html' },
    });
    const ui = await describeApiError(res, 'Network flapped');
    expect(ui.code).toBe('http_502');
    expect(ui.message).toBe('Network flapped');
  });

  it('tolerates a response with no error property at all', async () => {
    const res = makeJsonResponse({ data: 'something' }, 200);
    const ui = await describeApiError(res, 'Unknown');
    expect(ui.message).toBe('Unknown');
  });
});

describe('formatUiError', () => {
  it('joins message + hint with a space when hint present', () => {
    expect(formatUiError({ code: 'x', message: 'Boom.', hint: 'Retry please.' }))
      .toBe('Boom. Retry please.');
  });

  it('returns message only when hint is absent', () => {
    expect(formatUiError({ code: 'x', message: 'Boom.' })).toBe('Boom.');
  });

  it('handles empty hint gracefully', () => {
    expect(formatUiError({ code: 'x', message: 'Boom.', hint: '' })).toBe('Boom.');
  });
});
