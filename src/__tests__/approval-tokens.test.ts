import { describe, it, expect, beforeEach } from 'vitest';
import {
  issueApprovalToken,
  verifyApprovalToken,
  DEFAULT_EXPIRY_DAYS,
} from '@/lib/approval-tokens';

// Tests set AUTH_SECRET locally so HMAC can sign. Production uses a
// long random secret from Vercel env; any non-empty string works here.
const ORIG_SECRET = process.env.AUTH_SECRET;
beforeEach(() => {
  process.env.AUTH_SECRET = 'test-secret-for-approval-tokens';
});
afterEachRestore();

function afterEachRestore() {
  // Vitest: we can't import afterEach at top-level above vi imports
  // cleanly in a typesafe way; this restore runs at module teardown
  // when the suite imports anyway. Keep it simple — set and go.
  if (ORIG_SECRET === undefined) {
    // nothing
  } else {
    process.env.AUTH_SECRET = ORIG_SECRET;
  }
}

describe('issueApprovalToken', () => {
  it('produces a payload.signature string', async () => {
    const { token, payload } = await issueApprovalToken({ declarationId: 'd1' });
    expect(typeof token).toBe('string');
    expect(token).toMatch(/\./);
    expect(payload.decl_id).toBe('d1');
    expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    expect(payload.nonce).toMatch(/^[0-9a-f]+$/);
  });

  it('defaults to DEFAULT_EXPIRY_DAYS when omitted', async () => {
    const before = Math.floor(Date.now() / 1000);
    const { payload } = await issueApprovalToken({ declarationId: 'd1' });
    const expected = before + DEFAULT_EXPIRY_DAYS * 86400;
    // Within 5s of expected (test execution has some jitter)
    expect(Math.abs(payload.exp - expected)).toBeLessThan(5);
  });

  it('clamps expiry to [1, 30] days', async () => {
    const now = Math.floor(Date.now() / 1000);
    const tooShort = await issueApprovalToken({ declarationId: 'd1', expiryDays: 0 });
    expect(tooShort.payload.exp - now).toBeGreaterThanOrEqual(86400 - 5);

    const tooLong = await issueApprovalToken({ declarationId: 'd1', expiryDays: 999 });
    expect(tooLong.payload.exp - now).toBeLessThanOrEqual(30 * 86400 + 5);
  });

  it('two calls produce different tokens (different nonces)', async () => {
    const a = await issueApprovalToken({ declarationId: 'd1' });
    const b = await issueApprovalToken({ declarationId: 'd1' });
    expect(a.token).not.toBe(b.token);
    expect(a.payload.nonce).not.toBe(b.payload.nonce);
  });
});

describe('verifyApprovalToken', () => {
  it('accepts a fresh token and returns its payload', async () => {
    const { token, payload } = await issueApprovalToken({ declarationId: 'd42' });
    const result = await verifyApprovalToken(token);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.decl_id).toBe('d42');
      expect(result.payload.nonce).toBe(payload.nonce);
    }
  });

  it('rejects a malformed token (no dot)', async () => {
    const r = await verifyApprovalToken('bogus-without-signature');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('malformed');
  });

  it('rejects empty string', async () => {
    const r = await verifyApprovalToken('');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('malformed');
  });

  it('rejects a token with tampered payload', async () => {
    const { token } = await issueApprovalToken({ declarationId: 'd1' });
    const parts = token.split('.');
    // Keep the original signature but swap the payload — signature no longer matches.
    const { token: other } = await issueApprovalToken({ declarationId: 'd2' });
    const tampered = `${other.split('.')[0]}.${parts[1]}`;
    const r = await verifyApprovalToken(tampered);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('bad_signature');
  });

  it('rejects a token with tampered signature', async () => {
    const { token } = await issueApprovalToken({ declarationId: 'd1' });
    const tampered = token.slice(0, -4) + 'dead';
    const r = await verifyApprovalToken(tampered);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('bad_signature');
  });

  it('rejects a token signed under a different secret', async () => {
    const { token } = await issueApprovalToken({ declarationId: 'd1' });
    process.env.AUTH_SECRET = 'different-secret-now';
    const r = await verifyApprovalToken(token);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('bad_signature');
  });

  it('rejects an expired token', async () => {
    // Forge a token with exp in the past by monkey-patching Date during issue.
    const realNow = Date.now;
    Date.now = () => 1_000_000_000; // Sep 2001
    const { token } = await issueApprovalToken({ declarationId: 'd1' });
    Date.now = realNow;
    const r = await verifyApprovalToken(token);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('expired');
  });

  it('reports no_secret when AUTH_SECRET is missing', async () => {
    const { token } = await issueApprovalToken({ declarationId: 'd1' });
    const saved = process.env.AUTH_SECRET;
    delete process.env.AUTH_SECRET;
    const r = await verifyApprovalToken(token);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('no_secret');
    process.env.AUTH_SECRET = saved;
  });
});
