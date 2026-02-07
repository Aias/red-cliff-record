import { createHmac, timingSafeEqual } from 'node:crypto';

const COOKIE_NAME = 'rcr_session';
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

function getSecret(): string | undefined {
  return process.env.SESSION_SECRET;
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/** Build a signed session cookie value: `userId.iat.exp.signature` */
export function createSessionCookie(githubUserId: string): string {
  const secret = getSecret();
  if (!secret) throw new Error('SESSION_SECRET is not configured');

  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + MAX_AGE_SECONDS;
  const payload = `${githubUserId}.${iat}.${exp}`;
  const sig = sign(payload, secret);
  return `${payload}.${sig}`;
}

/** Parse and validate the `rcr_session` cookie. Returns GitHub user ID or null. */
export function parseSessionCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;

  const secret = getSecret();
  if (!secret) return null;

  const match = cookieHeader
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE_NAME}=`));
  if (!match) return null;

  const value = match.slice(COOKIE_NAME.length + 1);
  const parts = value.split('.');
  if (parts.length !== 4) return null;

  const [userId, iatStr, expStr, sig] = parts as [string, string, string, string];
  const payload = `${userId}.${iatStr}.${expStr}`;

  // Timing-safe signature comparison
  const expected = sign(payload, secret);
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) return null;

  // Check expiry
  const exp = Number(expStr);
  if (Number.isNaN(exp) || Math.floor(Date.now() / 1000) > exp) return null;

  return userId;
}

export function isAdminUser(githubUserId: string): boolean {
  return process.env.ADMIN_GITHUB_ID === githubUserId;
}

/** Whether auth is fully configured (all required env vars present). */
export function isAuthConfigured(): boolean {
  return !!(
    process.env.SESSION_SECRET &&
    process.env.ADMIN_GITHUB_ID &&
    process.env.GITHUB_CLIENT_ID &&
    process.env.GITHUB_CLIENT_SECRET
  );
}

const isDev = process.env.NODE_ENV !== 'production';

export function sessionSetCookieHeader(value: string): string {
  return `${COOKIE_NAME}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${MAX_AGE_SECONDS}${isDev ? '' : '; Secure'}`;
}

export function sessionClearCookieHeader(): string {
  return `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${isDev ? '' : '; Secure'}`;
}

/** Read a single cookie value by name from a Cookie header string. */
export function getCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match?.[1] ?? null;
}
