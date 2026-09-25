"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AuthTabs } from "../auth-tabs";
import { PasswordField } from "../password-field";
import { FormError } from "../form-error";
import { MailIcon } from "../icons";

interface SigninViewProps {
  initialEmail?: string;
  onEmailChange?: (email: string) => void;
  onUnverifiedSuccess: (user: { email: string }) => void;
  onSwitchToSignup: () => void;
  onForgotPassword: (email: string) => void;
}

type FormErrorKind = "missing-input" | "invalid-credentials" | "too-many" | "network";

export function SigninView({
  initialEmail,
  onEmailChange,
  onUnverifiedSuccess,
  onSwitchToSignup,
  onForgotPassword,
}: SigninViewProps) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail ?? "");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<FormErrorKind | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function renderFormError(kind: FormErrorKind) {
    if (kind === "missing-input") return "Enter your email and password.";
    // PRD §6(d): never reveal which the user got wrong, so one generic
    // message covers an unknown email and a wrong password alike.
    if (kind === "invalid-credentials") return "Email or password is incorrect.";
    if (kind === "too-many") return "Too many attempts. Try again in 15 minutes.";
    return "Something went wrong. Please try again.";
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    // Defensive only: the submit button is disabled until both fields are
    // non-empty, so this branch shouldn't be reachable in normal use.
    if (!email.trim() || !password) {
      setFormError("missing-input");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 401) {
        setFormError("invalid-credentials");
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

      if (data.verified) {
        // A real navigation, not a view switch — Dashboard is a separate route.
        router.push("/dashboard");
        return;
      }

      onUnverifiedSuccess({ email });
    } catch {
      setFormError("network");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <AuthTabs active="signin" onSelect={(tab) => (tab === "signup" ? onSwitchToSignup() : undefined)} />

      <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-slate-900">Welcome back</h1>
      <p className="mt-3 text-slate-500">Sign in to continue planning your next trip.</p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
        {formError === "invalid-credentials" && (
          <FormError id="signin-error" message={renderFormError(formError)} />
        )}

        <div>
          <label htmlFor="signin-email" className="text-sm font-medium text-slate-900">
            Email
          </label>
          <div className="relative mt-1.5">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
              <MailIcon />
            </span>
            <input
              id="signin-email"
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
              aria-describedby={formError ? "signin-error" : undefined}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <PasswordField
            id="signin-password"
            label="Password"
            placeholder="Enter your password"
            value={password}
            onChange={(value) => {
              setPassword(value);
              setFormError(null);
            }}
            autoComplete="current-password"
            describedBy={formError ? "signin-error" : undefined}
          />
          <div className="mt-2 text-right">
            <button
              type="button"
              onClick={() => onForgotPassword(email)}
              className="rounded text-sm font-medium text-blue-600 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
            >
              Forgot password?
            </button>
          </div>
        </div>

        {formError && formError !== "invalid-credentials" && (
          <FormError id="signin-error" message={renderFormError(formError)} />
        )}

        <button
          type="submit"
          disabled={submitting || !email || !password}
          className="w-full rounded-xl bg-gradient-to-b from-blue-500 to-blue-600 py-3.5 font-semibold text-white shadow-sm transition-colors enabled:hover:from-blue-600 enabled:hover:to-blue-700 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}