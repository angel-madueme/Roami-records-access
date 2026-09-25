import { NextResponse } from "next/server";
import { forgotPasswordRequestSchema } from "@/lib/validation/auth";
import { prisma } from "@/lib/prisma";
import { checkPasswordResetRequestRateLimit } from "@/lib/rate-limit";
import { sendPasswordResetEmail } from "@/lib/email/nodemailer";
import { generateSixDigitCode, VERIFICATION_CODE_TTL_MS } from "@/lib/verification-code";

// Identical response whether or not the email is registered — this
// endpoint never reveals account existence via response shape or status
// code (PRD Section 6(d)).
function genericResponse() {
  return NextResponse.json({
    message: "If an account exists for this email, a code has been sent.",
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = forgotPasswordRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { email } = parsed.data;

  const rateLimit = checkPasswordResetRequestRateLimit(email);
  if (!rateLimit.allowed) {
    const retryAfterSeconds = Math.ceil((rateLimit.retryAfterMs ?? 0) / 1000);
    return NextResponse.json(
      { error: "Too many requests. Try again later.", retryAfterSeconds },
      { status: 429, headers: { "Retry-After": retryAfterSeconds.toString() } }
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return genericResponse();
  }

  const code = generateSixDigitCode();
  const expiresAt = new Date(Date.now() + VERIFICATION_CODE_TTL_MS);

  // A user should never have two simultaneously valid reset codes: invalidate
  // any prior unconsumed token before issuing a new one.
  await prisma.$transaction([
    prisma.passwordResetToken.updateMany({
      where: { userId: user.id, consumedAt: null },
      data: { consumedAt: new Date() },
    }),
    prisma.passwordResetToken.create({
      data: { userId: user.id, code, expiresAt },
    }),
  ]);

  try {
    await sendPasswordResetEmail(user.email, code);
  } catch (err) {
    // Still return the generic response even on send failure — surfacing a
    // different response here would leak account existence (PRD Section
    // 6(d)), the exact thing this endpoint's identical-response shape exists
    // to prevent.
    console.error("Failed to send password reset email:", err);
  }

  return genericResponse();
}
