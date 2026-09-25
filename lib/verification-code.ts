import { randomInt } from "crypto";

// 10-minute expiry per PRD Section 10 / AGENTS.md.
export const VERIFICATION_CODE_TTL_MS = 10 * 60 * 1000;

export function generateSixDigitCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}
