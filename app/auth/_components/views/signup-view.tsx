"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { AuthTabs } from "../auth-tabs";
import { PasswordField } from "../password-field";
import { PasswordRequirements, meetsPasswordRequirements } from "../password-requirements";
import { FormError } from "../form-error";
import { emailSchema, fullNameSchema } from "@/lib/validation/auth";
import { PersonIcon, MailIcon } from "../icons";

interface SignupViewProps {
  /**
   * Seeds the email field when this panel mounts after a client-side
   * switch from Sign in — the value lives in the parent's carriedEmail so
   * it survives the view swap. Only ever a correctly-formatted, non-empty
   * carryover, never a claim about whether an account exists. See
   * DOCUMENTATION.md Section 5, "Email carryover."
   */
  initialEmail?: string;
  /**
   * Reports the email as the user types so the parent can carry it over to
   * the other panel on a switch. Fired on every keystroke, not just on
   * valid values — the parent decides at switch time whether the currently
   * held value is worth carrying.
   */
  onEmailChange?: (email: string) => void;
  onSuccess: (user: { email: string }) => void;
  onSwitchToSignin: () => void;
}

type FormErrorKind = "duplicate" | "too-many" | "network";

export function SignupView({ initialEmail, onEmailChange, onSuccess, onSwitchToSignin }: SignupViewProps) {
  const [fullName, setFullName] = useState("");
  // Seeded from the parent's carryover when this panel mounts after a
  // switch from Sign in — see auth-view-client.tsx. The parent only ever
  // passes an email that was correctly-formatted and non-empty at the
  // moment of the switch; this is a field pre-fill, never a statement
  // about whether an account exists (PRD §6 stays untouched).
  const [email, setEmail] = useState(initialEmail ?? "");
  const [password, setPassword] = useState("");
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<FormErrorKind | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fullNameValidation = fullNameSchema.safeParse(fullName);
  const emailValidation = emailSchema.safeParse(email);
  const fullNameValid = fullNameValidation.success;
  const emailValid = emailValidation.success;
  const passwordValid = meetsPasswordRequirements(password);
  const fullNameInvalid = fullName.trim().length > 0 && !fullNameValid;
  const emailInvalid = email.trim().length > 0 && !emailValid;

  const canSubmit = fullNameValid && emailValid && passwordValid;

  // Field-level errors read from the same Zod schema the API validates
  // against, so the client message can never drift from the server's.
  const fullNameError = fullNameInvalid
    ? (fullNameValidation.error?.issues[0]?.message ?? "Full name can only contain letters and spaces.")
    : submitted && fullName.trim() === ""
      ? "Enter your full name."
      : null;
  const emailError = emailInvalid
    ? (emailValidation.error?.issues[0]?.message ?? "Enter a valid email address.")
    : submitted && email.trim() === ""
      ? "Enter your email address."
      : null;

  // The submit button is enabled only when canSubmit holds (PRD §7's client
  // submit gate, driven by the shared PASSWORD_RULES), so this and the empty
  // field messages are defensive guards for paths a disabled button can't
  // normally reach — if one ever fires, the exact intended copy shows rather
  // than a raw "Invalid input." from the API.
  const passwordError = submitted && !passwordValid ? "Password doesn't meet the requirements above." : null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setFormError(null);
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email, password }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 409) {
        setFormError("duplicate");
        return;
      }
      if (res.status === 429) {
        setFormError("too-many");
        return;
      }
      if (!res.ok) {
        setFormError("network");
        return;
      }

      onSuccess({ email: data.email });
    } catch {
      setFormError("network");
    } finally {
      setSubmitting(false);
    }
  }

  function renderFormError(kind: FormErrorKind) {
    if (kind === "duplicate") {
      return (
        <>
          An account with this email already exists.{" "}
          <button
            type="button"
            onClick={onSwitchToSignin}
            className="rounded font-medium text-red-700 underline underline-offset-2 hover:text-red-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-1"
          >
            Sign in
          </button>
        </>
      );
    }
    if (kind === "too-many") {
      return "Too many attempts. Try again in a few minutes.";
    }
    return "Something went wrong. Please try again.";
  }

  return (
    <div>
      <AuthTabs active="signup" onSelect={(tab) => (tab === "signin" ? onSwitchToSignin() : undefined)} />

      <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-slate-900">
        Create your account
      </h1>
      <p className="mt-3 text-slate-500">
        Save destinations, organise upcoming trips, and keep your stays and
        activities in one place.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
        {(formError === "duplicate" || formError === "network") && (
          <FormError id="signup-error" message={renderFormError(formError)} />
        )}

        <div>
          <label htmlFor="full-name" className="text-sm font-medium text-slate-900">
            Full name
          </label>
          <div className="relative mt-1.5">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
              <PersonIcon />
            </span>
            <input
              id="full-name"
              type="text"
              required
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                setFormError(null);
              }}
              placeholder="John Doe"
              autoComplete="name"
              aria-invalid={fullNameInvalid || undefined}
              aria-describedby={fullNameError ? "full-name-error" : undefined}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {fullNameError && (
            <div className="mt-1.5">
              <FormError id="full-name-error" message={fullNameError} />
            </div>
          )}
        </div>

        <div>
          <label htmlFor="signup-email" className="text-sm font-medium text-slate-900">
            Email
          </label>
          <div className="relative mt-1.5">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
              <MailIcon />
            </span>
            <input
              id="signup-email"
              type="email"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                onEmailChange?.(e.target.value);
                setFormError(null);
              }}
              placeholder="you@company.com"
              autoComplete="email"
              aria-invalid={emailInvalid || undefined}
              aria-describedby={[emailError ? "signup-email-error" : undefined, formError ? "signup-error" : undefined].filter(Boolean).join(" ") || undefined}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {emailError && (
            <div className="mt-1.5">
              <FormError id="signup-email-error" message={emailError} />
            </div>
          )}
        </div>

        <div>
          <PasswordField
            id="signup-password"
            label="Password"
            placeholder="Create a password"
            value={password}
            onChange={(value) => {
              setPassword(value);
              setFormError(null);
            }}
            autoComplete="new-password"
            describedBy={passwordError ? "signup-password-error" : undefined}
            onFocus={() => setPasswordFocused(true)}
            onBlur={() => setPasswordFocused(false)}
          />
          <PasswordRequirements password={password} show={passwordFocused || password.length > 0} />
        </div>

        {passwordError && (
          <FormError id="signup-password-error" message="Password doesn't meet the requirements above." />
        )}
        {formError === "too-many" && <FormError id="signup-error" message={renderFormError(formError)} />}

        <button
          type="submit"
          disabled={submitting || !canSubmit}
          className="w-full rounded-xl bg-gradient-to-b from-blue-500 to-blue-600 py-3.5 font-semibold text-white shadow-sm transition-colors enabled:hover:from-blue-600 enabled:hover:to-blue-700 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        >
          {submitting ? "Creating account…" : "Create account"}
        </button>
      </form>
    </div>
  );
}