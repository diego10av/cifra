// Cookie-based session auth using HMAC-SHA256 via the Web Crypto API, so
// the same code works in both Node (API routes) and Edge (middleware).
//
// The previous design stored AUTH_SECRET as the cookie value; any leak
// would compromise the platform permanently. We now issue a random session
// id and sign it: `cookie = <sessionId>.<hmacHex>`. The secret never
// leaves the server.

const COOKIE_NAME = 'cifra_auth';
const revoked = new Set<string>();

const enc = new TextEncoder();

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
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}

function randomSessionId(): string {
  const buf = new Uint8Array(24);
  crypto.getRandomValues(buf);
  // base64url
  let s = '';
  for (let i = 0; i < buf.length; i++) s += String.fromCharCode(buf[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sign(sessionId: string): Promise<string> {
  const key = await hmacKey();
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(sessionId));
  return toHex(sig);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function issueSessionCookie(): Promise<{ name: string; value: string; maxAge: number }> {
  const sessionId = randomSessionId();
  const signature = await sign(sessionId);
  return {
    name: COOKIE_NAME,
    value: `${sessionId}.${signature}`,
    maxAge: 60 * 60 * 24 * 30, // 30 days
  };
}

export async function verifySessionCookie(raw: string | undefined | null): Promise<boolean> {
  if (!raw) return false;
  const idx = raw.indexOf('.');
  if (idx <= 0 || idx === raw.length - 1) return false;
  const sessionId = raw.slice(0, idx);
  const sig = raw.slice(idx + 1);
  if (revoked.has(sessionId)) return false;
  let expected: string;
  try {
    expected = await sign(sessionId);
  } catch {
    return false;
  }
  return timingSafeEqual(sig, expected);
}

export function revokeSession(raw: string): void {
  const idx = raw.indexOf('.');
  if (idx > 0) revoked.add(raw.slice(0, idx));
}

export const AUTH_COOKIE_NAME = COOKIE_NAME;
