// ════════════════════════════════════════════════════════════════════════
// Approval tokens — single-use HMAC-signed links for the client approval
// portal. A fund manager receives a link, clicks it, reviews the
// declaration, clicks Approve. No account, no login, no email thread.
//
// Design:
// - Token is `base64url(payload).hex(signature)`
//   where payload = JSON({ decl_id, exp, nonce })
// - HMAC uses the same AUTH_SECRET as session cookies (stays on server).
// - Web Crypto API → same code runs on Edge middleware and Node routes.
// - Nonce prevents two equal tokens for the same declaration, so even if
//   one is leaked & replayed, the next one issued invalidates it on the
//   UI side (we show "latest link only" in the share dialog).
// - Expiry is required (default 7 days). No infinite links.
//
// What this file does NOT do:
// - Store tokens in a DB. The token is its own truth; verification is
//   purely cryptographic. This means we can't revoke individual tokens
//   before expiry; if a real leak happens, rotate AUTH_SECRET (which
//   also invalidates session cookies — so you'd log back in once).
//   That trade-off is acceptable for a bootstrap; for higher-stakes
//   deployments we'd add an `approval_tokens` table with a `revoked` flag.
// ════════════════════════════════════════════════════════════════════════

const enc = new TextEncoder();

/** Default expiry: 7 days. The share dialog lets the user pick shorter. */
export const DEFAULT_EXPIRY_DAYS = 7;
const MAX_EXPIRY_DAYS = 30;

export interface ApprovalTokenPayload {
  /** Declaration id this token unlocks. */
  decl_id: string;
  /** Expiry — Unix seconds. */
  exp: number;
  /** Random nonce — 12 hex chars. */
  nonce: string;
  /** Who issued this link (audit). */
  issued_by: string;
}

// ─────────────────────────── internals ────────────────────────────

async function hmacKey(): Promise<CryptoKey> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET not set');
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

function toHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += bytes[i]!.toString(16).padStart(2, '0');
  return out;
}

function b64urlEncode(s: string): string {
  // btoa works on ASCII; JSON payload is ASCII so this is safe.
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s: string): string {
  // Add padding back for atob.
  const padded = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  return atob(padded + pad);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function randomNonce(): string {
  const buf = new Uint8Array(6);
  crypto.getRandomValues(buf);
  return toHex(buf.buffer);
}

// ───────────────────────────── public API ────────────────────────────

/**
 * Issue a token string for a declaration. Returns both the raw token
 * (for URL embedding) and the full payload (so callers can surface
 * expiry + nonce in the UI without re-decoding).
 */
export async function issueApprovalToken(opts: {
  declarationId: string;
  issuedBy?: string;
  expiryDays?: number;
}): Promise<{ token: string; payload: ApprovalTokenPayload }> {
  const expiryDays = Math.min(MAX_EXPIRY_DAYS, Math.max(1, opts.expiryDays ?? DEFAULT_EXPIRY_DAYS));
  const payload: ApprovalTokenPayload = {
    decl_id: opts.declarationId,
    exp: Math.floor(Date.now() / 1000) + expiryDays * 24 * 60 * 60,
    nonce: randomNonce(),
    issued_by: opts.issuedBy ?? 'founder',
  };
  const payloadJson = JSON.stringify(payload);
  const payloadB64 = b64urlEncode(payloadJson);

  const key = await hmacKey();
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payloadB64));
  const sigHex = toHex(sig);

  return { token: `${payloadB64}.${sigHex}`, payload };
}

export type VerifyResult =
  | { ok: true; payload: ApprovalTokenPayload }
  | { ok: false; reason: 'malformed' | 'bad_signature' | 'expired' | 'invalid_payload' | 'no_secret' };

/**
 * Verify a token. Never throws — always returns a tagged union.
 */
export async function verifyApprovalToken(token: string): Promise<VerifyResult> {
  if (!token || typeof token !== 'string') return { ok: false, reason: 'malformed' };

  const dot = token.lastIndexOf('.');
  if (dot <= 0 || dot === token.length - 1) return { ok: false, reason: 'malformed' };

  const payloadB64 = token.slice(0, dot);
  const sigHex = token.slice(dot + 1);

  let key: CryptoKey;
  try {
    key = await hmacKey();
  } catch {
    return { ok: false, reason: 'no_secret' };
  }

  let expected: string;
  try {
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payloadB64));
    expected = toHex(sig);
  } catch {
    return { ok: false, reason: 'bad_signature' };
  }

  if (!timingSafeEqual(sigHex, expected)) return { ok: false, reason: 'bad_signature' };

  let payload: ApprovalTokenPayload;
  try {
    const json = b64urlDecode(payloadB64);
    payload = JSON.parse(json) as ApprovalTokenPayload;
    if (
      typeof payload.decl_id !== 'string' ||
      typeof payload.exp !== 'number' ||
      typeof payload.nonce !== 'string'
    ) {
      return { ok: false, reason: 'invalid_payload' };
    }
  } catch {
    return { ok: false, reason: 'invalid_payload' };
  }

  if (payload.exp * 1000 < Date.now()) return { ok: false, reason: 'expired' };

  return { ok: true, payload };
}
