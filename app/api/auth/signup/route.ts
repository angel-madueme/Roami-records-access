import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { Prisma } from "@prisma/client";
import { signupSchema } from "@/lib/validation/auth";
import { prisma } from "@/lib/prisma";
import { checkSignupRateLimit } from "@/lib/rate-limit";
import { sendVerificationEmail } from "@/lib/email/nodemailer";
import { createSession } from "@/lib/session";
import { generateSixDigitCode, VERIFICATION_CODE_TTL_MS } from "@/lib/verification-code";

const BCRYPT_COST_FACTOR = 12;

function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  return forwardedFor?.split(",")[0]?.trim() || "unknown";
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rateLimit = checkSignupRateLimit(ip);
  if (!rateLimit.allowed) {
    const retryAfterSeconds = Math.ceil((rateLimit.retryAfterMs ?? 0) / 1000);
    return NextResponse.json(
      { error: "Too many signup attempts. Try again later." },
      { status: 429, headers: { "Retry-After": retryAfterSeconds.toString() } }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { fullName, email, password } = parsed.data;
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST_FACTOR);
  const code = generateSixDigitCode();
  const expiresAt = new Date(Date.now() + VERIFICATION_CODE_TTL_MS);

  let userId: string;
  try {
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName,
        emailVerificationCodes: {
          create: { code, expiresAt },
        },
      },
    });
    userId = user.id;
  } catch (err) {
    // Duplicate signup for an existing email — the unique constraint on
    // User.email is what makes this idempotent: a retried/duplicate
    // submission never creates a second account.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }
    throw err;
  }

  // Per PRD Section 6(a): the session is created here, at signup, before the
  // account is verified. Protected routes must check emailVerified as well
  // as session validity — see the note under PRD Section 6, flow (a).
  await createSession(userId);

  try {
    await sendVerificationEmail(email, code);
  } catch (err) {
    console.error("Failed to send verification email:", err);
    return NextResponse.json(
      { error: "Account created, but we couldn't send the verification email. Use the resend option to try again." },
      { status: 502 }
    );
  }

  return NextResponse.json({ userId, email }, { status: 201 });
}
