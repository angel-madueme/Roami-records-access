import { NextResponse } from "next/server";
import { verifyCodeSchema } from "@/lib/validation/auth";
import { prisma } from "@/lib/prisma";
import { validateSession } from "@/lib/session";

function incorrectCodeResponse() {
  return NextResponse.json(
    { error: "Incorrect code. Check the code and try again." },
    { status: 400 }
  );
}

export async function POST(request: Request) {
  // Identified via the session cookie, not a body field — both signup and
  // the signin "unverified account" branch (PRD Section 6, flows (a)/(c))
  // create a session before routing here, so one is always present.
  const session = await validateSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = verifyCodeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { code } = parsed.data;

  // Look up by code first (ignoring expiry) so we can tell "wrong code" apart
  // from "right code, but it's expired" — expiry is checked here, against
  // the server clock, never left to a client-side countdown.
  const matchingCode = await prisma.emailVerificationCode.findFirst({
    where: { userId: session.userId, code, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!matchingCode) {
    return incorrectCodeResponse();
  }

  if (matchingCode.expiresAt.getTime() <= Date.now()) {
    return NextResponse.json(
      { error: "This code has expired. Request a new code." },
      { status: 400 }
    );
  }

  await prisma.$transaction([
    prisma.emailVerificationCode.update({
      where: { id: matchingCode.id },
      data: { consumedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: session.userId },
      data: { emailVerified: true },
    }),
  ]);

  // No session is created here — the user already has one from signup
  // (or from the unverified-signin branch, flow (c)).
  return NextResponse.json({ success: true });
}
