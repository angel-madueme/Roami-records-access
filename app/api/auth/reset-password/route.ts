import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { resetPasswordSchema } from "@/lib/validation/auth";
import { prisma } from "@/lib/prisma";
import { verifyResetProof } from "@/lib/password-reset";
import { invalidateAllUserSessions } from "@/lib/session";

const BCRYPT_COST_FACTOR = 12;

function invalidProofResponse() {
  return NextResponse.json(
    { error: "This reset link has expired. Start over." },
    { status: 400 }
  );
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { proof, newPassword } = parsed.data;

  const verified = verifyResetProof(proof);
  if (!verified) {
    return invalidProofResponse();
  }

  // Re-check the token's own DB state too, not just the proof's signed
  // expiry — expiry (and single-use) must live in the database, never be
  // trusted from a value that was merely signed earlier in the request.
  const token = await prisma.passwordResetToken.findUnique({
    where: { id: verified.tokenId },
  });
  if (!token || token.consumedAt || token.expiresAt.getTime() <= Date.now()) {
    return invalidProofResponse();
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST_FACTOR);

  await prisma.$transaction([
    prisma.passwordResetToken.update({
      where: { id: token.id },
      data: { consumedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: token.userId },
      data: { passwordHash },
    }),
  ]);

  // This is the concrete behavior that justifies the DB-backed session
  // design (PRD Section 10): kill every existing session for this user, not
  // just the one that happened to perform the reset.
  await invalidateAllUserSessions(token.userId);

  return NextResponse.json({ success: true });
}
