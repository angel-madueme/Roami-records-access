/**
 * Rate limiting scaffold.
 *
 * This store is in-memory and per-process only — it resets on restart and
 * does not coordinate across multiple server instances/replicas. That's
 * acceptable for the assessment demo, but this should move to a
 * persistent, shared store (e.g. Redis) before any real deployment beyond
 * this slice.
 *
 * Thresholds below are fixed per PRD Section 10 / AGENTS.md — do not
 * change one without updating the other.
 */

interface WindowEntry {
  count: number;
  windowStart: number;
}

const store = new Map<string, WindowEntry>();

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs?: number;
}

function checkFixedWindow(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now - entry.windowStart >= windowMs) {
    store.set(key, { count: 1, windowStart: now });
    return { allowed: true };
  }

  if (entry.count < limit) {
    entry.count += 1;
    return { allowed: true };
  }

  return { allowed: false, retryAfterMs: entry.windowStart + windowMs - now };
}

const SIGNUP_LIMIT = 5;
const SIGNUP_WINDOW_MS = 60 * 60 * 1000; // 1 hour

const SIGNIN_LIMIT = 10;
const SIGNIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

const RESET_REQUEST_LIMIT = 5;
const RESET_REQUEST_WINDOW_MS = 60 * 60 * 1000; // 1 hour

const RESEND_COOLDOWN_MS = 60 * 1000; // 1 request per 60 seconds
const RESEND_HOURLY_LIMIT = 5;
const RESEND_HOURLY_WINDOW_MS = 60 * 60 * 1000; // capped at 5 per hour

/** Signup: 5 requests per IP per hour. */
export function checkSignupRateLimit(ip: string): RateLimitResult {
  return checkFixedWindow(`signup:${ip}`, SIGNUP_LIMIT, SIGNUP_WINDOW_MS);
}

/** Signin: 10 attempts per email per 15 minutes. */
export function checkSigninRateLimit(email: string): RateLimitResult {
  return checkFixedWindow(`signin:${email.toLowerCase()}`, SIGNIN_LIMIT, SIGNIN_WINDOW_MS);
}

/** Password-reset-request: 5 requests per email per hour. */
export function checkPasswordResetRequestRateLimit(email: string): RateLimitResult {
  return checkFixedWindow(
    `reset-request:${email.toLowerCase()}`,
    RESET_REQUEST_LIMIT,
    RESET_REQUEST_WINDOW_MS
  );
}

/**
 * Verification-code-resend: 1 request per 60 seconds, capped at 5 per hour
 * per account. Both the cooldown and the hourly cap must pass for a resend
 * to be allowed; the cooldown is checked first since it's the primary
 * defense (see PRD Section 10).
 */
export function checkResendRateLimit(accountId: string): RateLimitResult {
  const cooldown = checkFixedWindow(`resend-cooldown:${accountId}`, 1, RESEND_COOLDOWN_MS);
  if (!cooldown.allowed) return cooldown;

  return checkFixedWindow(`resend-hourly:${accountId}`, RESEND_HOURLY_LIMIT, RESEND_HOURLY_WINDOW_MS);
}
