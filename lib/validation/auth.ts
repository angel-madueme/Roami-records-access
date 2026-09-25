import { z } from "zod";

export const PASSWORD_RULES = [
  {
    key: "length",
    label: "8+ characters",
    message: "Password must be at least 8 characters",
    test: (password: string) => password.length >= 8,
  },
  {
    key: "uppercase",
    label: "1 uppercase letter",
    message: "Password must contain at least one uppercase letter",
    test: (password: string) => /[A-Z]/.test(password),
  },
  {
    key: "lowercase",
    label: "1 lowercase letter",
    message: "Password must contain at least one lowercase letter",
    test: (password: string) => /[a-z]/.test(password),
  },
  {
    key: "number",
    label: "1 number",
    message: "Password must contain at least one number",
    test: (password: string) => /[0-9]/.test(password),
  },
  {
    key: "symbol",
    label: "1 symbol",
    message: "Password must contain at least one symbol",
    test: (password: string) => /[^A-Za-z0-9]/.test(password),
  },
] as const;

export function meetsPasswordRequirements(password: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(password));
}

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Email is required")
  .email("Enter a valid email address")
  .transform((value) => value.toLowerCase());

export const fullNameSchema = z
  .string()
  .trim()
  .min(1, "Full name is required")
  .regex(/^[A-Za-z]+(?: [A-Za-z]+)*$/, "Full name can only contain letters and spaces");

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .superRefine((value, ctx) => {
    for (const rule of PASSWORD_RULES) {
      if (rule.key === "length") continue;
      if (!rule.test(value)) {
        ctx.addIssue({ code: "custom", message: rule.message });
      }
    }
  });

const sixDigitCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Code must be exactly 6 digits");

export const signupSchema = z.object({
  fullName: fullNameSchema,
  email: emailSchema,
  password: passwordSchema,
});
export type SignupInput = z.infer<typeof signupSchema>;

export const signinSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});
export type SigninInput = z.infer<typeof signinSchema>;

export const forgotPasswordRequestSchema = z.object({
  email: emailSchema,
});
export type ForgotPasswordRequestInput = z.infer<typeof forgotPasswordRequestSchema>;

// The account is identified via the session cookie (lib/session.ts), not a
// body field — both signup and the signin "unverified account" branch
// create a session before routing to Verify email, so one always exists.
export const verifyCodeSchema = z.object({
  code: sixDigitCodeSchema,
});
export type VerifyCodeInput = z.infer<typeof verifyCodeSchema>;

export const verifyResetCodeSchema = z.object({
  email: emailSchema,
  code: sixDigitCodeSchema,
});
export type VerifyResetCodeInput = z.infer<typeof verifyResetCodeSchema>;

// `proof` is the short-lived signed token issued by verify-reset-code on a
// successful match (lib/password-reset.ts) — not the raw code. This is what
// stops a user from skipping straight to reset-password with a guessed code.
export const resetPasswordSchema = z.object({
  proof: z.string().trim().min(1, "Proof is required"),
  newPassword: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
