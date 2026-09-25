import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkResendRateLimit } from "@/lib/rate-limit";
import { sendVerificationEmail } from "@/lib/email/nodemailer";
import { generateSixDigitCode, VERIFICATION_CODE_TTL_MS } from "@/lib/verification-code";
import { validateSession } from "@/lib/session";

export async function POST() {
  // Identified via the session cookie, not a body field — see verify-email
  // for why one is always present by the time this endpoint is reachable.
  const session = await validateSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || user.emailVerified) {
    return NextResponse.json({ success: true });
  }

  const rateLimit = checkResendRateLimit(user.id);
  if (!rateLimit.allowed) {
    const retryAfterSeconds = Math.ceil((rateLimit.retryAfterMs ?? 0) / 1000);
    return NextResponse.json(
      { error: "Too many resend requests. Try again later.", retryAfterSeconds },
      { status: 429, headers: { "Retry-After": retryAfterSeconds.toString() } }
    );
  }

  const code = generateSixDigitCode();
  const expiresAt = new Date(Date.now() + VERIFICATION_CODE_TTL_MS);

  // A user should never have two simultaneously valid codes: invalidate any
  // prior unconsumed code before issuing a new one.
  await prisma.$transaction([
    prisma.emailVerificationCode.updateMany({
      where: { userId: user.id, consumedAt: null },
      data: { consumedAt: new Date() },
    }),
    prisma.emailVerificationCode.create({
      data: { userId: user.id, code, expiresAt },
    }),
  ]);

  try {
    await sendVerificationEmail(user.email, code);
  } catch (err) {
    console.error("Failed to send verification email:", err);
    return NextResponse.json(
      { error: "We couldn't send the verification email. Please try again in a moment." },
      { status: 502 }
    );
  }

  return NextResponse.json({ success: true });
}
