import nodemailer from "nodemailer";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * Builds the RFC 5322 address used on the `From` header. The sender name and
 * address are configuration (SMTP_FROM_NAME / SMTP_FROM_EMAIL — so a deployed
 * server can brand its mail without a code change), with the Roami defaults
 * kept as fallbacks so local/dev setups never fail to send. Falls back per
 * field, not all-or-nothing: if only one env var is set the other keeps its
 * default.
 */
function getFromAddress(): string {
  const name = process.env.SMTP_FROM_NAME?.trim() || "Roami";
  const email = process.env.SMTP_FROM_EMAIL?.trim() || "no-reply@roami.dev";
  return `"${name}" <${email}>`;
}

export function getTransport() {
  return nodemailer.createTransport({
    host: requireEnv("SMTP_HOST"),
    port: Number(requireEnv("SMTP_PORT")),
    auth: {
      user: requireEnv("SMTP_USER"),
      pass: requireEnv("SMTP_PASS"),
    },
  });
}

/** Sends a 6-digit email verification code to the given address. */
export async function sendVerificationEmail(to: string, code: string): Promise<void> {
  const transport = getTransport();
  await transport.sendMail({
    from: getFromAddress(),
    to,
    subject: "Verify your Roami email",
    text: `Your Roami verification code is ${code}. It expires in 10 minutes.`,
    html: `<p>Your Roami verification code is <strong>${code}</strong>.</p><p>It expires in 10 minutes.</p>`,
  });
}

/** Sends a 6-digit password reset code to the given address. */
export async function sendPasswordResetEmail(to: string, code: string): Promise<void> {
  const transport = getTransport();
  await transport.sendMail({
    from: getFromAddress(),
    to,
    subject: "Reset your Roami password",
    text: `Your Roami password reset code is ${code}. It expires in 10 minutes. If you didn't request this, you can ignore this email.`,
    html: `<p>Your Roami password reset code is <strong>${code}</strong>.</p><p>It expires in 10 minutes. If you didn't request this, you can ignore this email.</p>`,
  });
}
