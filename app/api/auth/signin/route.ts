import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { signinSchema } from "@/lib/validation/auth";
import { prisma } from "@/lib/prisma";
import { checkSigninRateLimit } from "@/lib/rate-limit";
import { createSession } from "@/lib/session";
import { generateSixDigitCode, VERIFICATION_CODE_TTL_MS } from "@/lib/verification-code";
import { sendVerificationEmail } from "@/lib/email/nodemailer";

function invalidCredentialsResponse() {
  return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = signinSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { email, password } = parsed.data;

  const rateLimit = checkSigninRateLimit(email);
  if (!rateLimit.allowed) {
    const retryAfterSeconds = Math.ceil((rateLimit.retryAfterMs ?? 0) / 1000);
    return NextResponse.json(
      { error: "Too many signin attempts. Try again later." },
      { status: 429, headers: { "Retry-After": retryAfterSeconds.toString() } }
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return invalidCredentialsResponse();
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    return invalidCredentialsResponse();
  }

  if (!user.emailVerified) {
    // PRD Section 6, flow (c): credentials are correct but the account
    // isn't verified — create a session now (same trust model as signup)
    // and route to Verify email instead of completing a normal signin.
    await createSession(user.id);

    const code = generateSixDigitCode();
    const expiresAt = new Date(Date.now() + VERIFICATION_CODE_TTL_MS);
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
        { error: "Signed in, but we couldn't send the verification email. Use the resend option to try again." },
        { status: 502 }
      );
    }

    return NextResponse.json({ verified: false });
  }

  await createSession(user.id);
  return NextResponse.json({ verified: true });
}
