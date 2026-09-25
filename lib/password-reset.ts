import { createHmac, timingSafeEqual } from "crypto";

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("Missing required environment variable: SESSION_SECRET");
  }
  return secret;
}

/**
 * Signs a short-lived proof that verify-reset-code succeeded for a given
 * PasswordResetToken, without consuming the token yet. reset-password
 * verifies this proof instead of re-checking the raw code, so a guessed
 * code alone can't reach reset-password directly — it has to come from a
 * real verify-reset-code success. Expiry mirrors the underlying token's.
 */
export function signResetProof(tokenId: string, expiresAt: Date): string {
  const payload = `${tokenId}.${expiresAt.getTime()}`;
  const signature = createHmac("sha256", getSecret()).update(payload).digest("hex");
  return `${payload}.${signature}`;
}

/**
 * Verifies a proof's signature and expiry (against the server clock).
 * Returns the PasswordResetToken id it was issued for for the caller to
 * re-check the token's own DB state, or null if invalid/tampered/expired.
 */
export function verifyResetProof(proof: string): { tokenId: string } | null {
  const parts = proof.split(".");
  if (parts.length !== 3) return null;
  const [tokenId, expiresAtStr, signature] = parts;
  if (!tokenId || !expiresAtStr || !signature) return null;

  const expected = createHmac("sha256", getSecret())
    .update(`${tokenId}.${expiresAtStr}`)
    .digest("hex");
  const expectedBuf = Buffer.from(expected, "hex");
  const providedBuf = Buffer.from(signature, "hex");
  if (expectedBuf.length !== providedBuf.length) return null;
  if (!timingSafeEqual(expectedBuf, providedBuf)) return null;

  const expiresAt = Number(expiresAtStr);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;

  return { tokenId };
}
