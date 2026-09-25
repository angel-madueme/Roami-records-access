import { cookies } from "next/headers";
import { randomBytes, createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";

const SESSION_COOKIE_NAME = "roami_session";
// 30-day fixed lifetime, not renewed on activity — per PRD Section 10.
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("Missing required environment variable: SESSION_SECRET");
  }
  return secret;
}

function sign(rawId: string): string {
  return createHmac("sha256", getSessionSecret()).update(rawId).digest("hex");
}

/**
 * Generates a new opaque, signed session id: `${rawId}.${signature}`.
 * The raw id is random and unguessable; the signature lets a tampered
 * cookie value be rejected before it ever reaches the database.
 */
function generateSignedSessionId(): string {
  const rawId = randomBytes(32).toString("hex");
  return `${rawId}.${sign(rawId)}`;
}

/**
 * Verifies the signature on a signed session id without touching the
 * database. Returns the raw id if valid, or null if malformed/tampered.
 */
function verifySignature(signedId: string): string | null {
  const [rawId, signature] = signedId.split(".");
  if (!rawId || !signature) return null;

  const expected = Buffer.from(sign(rawId), "hex");
  const provided = Buffer.from(signature, "hex");
  if (expected.length !== provided.length) return null;

  return timingSafeEqual(expected, provided) ? rawId : null;
}

export async function setSessionCookie(signedSessionId: string, expiresAt: Date): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, signedSessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function getSessionCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Creates a new database-backed session for the given user, sets the
 * session cookie, and returns the created Session row.
 */
export async function createSession(userId: string) {
  const signedSessionId = generateSignedSessionId();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  const session = await prisma.session.create({
    data: { userId, sessionId: signedSessionId, expiresAt },
  });

  await setSessionCookie(signedSessionId, expiresAt);

  return session;
}

/**
 * Reads the session cookie, verifies its signature, and checks it against
 * the Session table. Returns the session's userId if valid, or null if the
 * cookie is missing, tampered, unknown to the database, or expired.
 */
export async function validateSession(): Promise<{ userId: string } | null> {
  const signedSessionId = await getSessionCookie();
  if (!signedSessionId) return null;

  const rawId = verifySignature(signedSessionId);
  if (!rawId) return null;

  const session = await prisma.session.findUnique({
    where: { sessionId: signedSessionId },
  });
  if (!session) return null;

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session.delete({ where: { id: session.id } });
    return null;
  }

  return { userId: session.userId };
}

/**
 * Ends the current session: removes its row from the database and clears
 * the cookie. Used for sign-out.
 */
export async function destroySession(): Promise<void> {
  const signedSessionId = await getSessionCookie();
  if (signedSessionId) {
    await prisma.session.deleteMany({ where: { sessionId: signedSessionId } });
  }
  await clearSessionCookie();
}

/**
 * Invalidates every session belonging to a user. Must be called when a
 * password reset completes, per PRD Section 6(d) and AGENTS.md.
 */
export async function invalidateAllUserSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
}
