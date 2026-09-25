import { NextResponse } from "next/server";
import { verifyResetCodeSchema } from "@/lib/validation/auth";
import { prisma } from "@/lib/prisma";
import { signResetProof } from "@/lib/password-reset";

// Same status code and shape for "no such account" and "no matching
// unconsumed token" — the distinction the expired case makes below is in
// the message text only, never in the status code, so this response can't
// be used to enumerate which emails are registered.
function incorrectCodeResponse() {
  return NextResponse.json(
    { error: "Incorrect code. Check the code and try again." },
    { status: 400 }
  );
}

export async function POST(request: Request) {
  // Legitimately no session at this point in the flow — the user isn't
  // authenticated yet, so identify by email + code together (unlike
  // verify-email, which has a session to key off of).
  const body = await request.json().catch(() => null);
  const parsed = verifyResetCodeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { email, code } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return incorrectCodeResponse();
  }

  const matchingToken = await prisma.passwordResetToken.findFirst({
    where: { userId: user.id, code, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!matchingToken) {
    return incorrectCodeResponse();
  }

  if (matchingToken.expiresAt.getTime() <= Date.now()) {
    return NextResponse.json(
      { error: "This code has expired. Request a new code." },
      { status: 400 }
    );
  }

  // Not consumed here — reset-password consumes it once a new password is
  // actually set. This step only confirms the code is valid and issues a
  // proof the next step can verify without re-checking the raw code.
  const proof = signResetProof(matchingToken.id, matchingToken.expiresAt);

  return NextResponse.json({ success: true, proof });
}
