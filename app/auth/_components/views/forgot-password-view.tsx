"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { AuthTabs } from "../auth-tabs";
import { MailIcon } from "../icons";
import { FormError } from "../form-error";

interface ForgotPasswordViewProps {
  onSubmitted: (email: string) => void;
  onSelectTab: (tab: "signup" | "signin") => void;
  /** Prefill from the Sign in screen's email field (only when it's validly formatted). */
  initialEmail?: string;
}

export function ForgotPasswordView({ onSubmitted, onSelectTab, initialEmail }: ForgotPasswordViewProps) {
  const [email, setEmail] = useState(initialEmail ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      // Always proceed regardless of the response — this endpoint never
      // reveals whether the email is registered, and neither does the UI.
      onSubmitted(email);
    } catch {
      setError("Something went wrong. Try again.");
      setSubmitting(false);
    }
  }

  return (
    <div>
      <AuthTabs active="signin" onSelect={onSelectTab} />

      <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-slate-900">
        Forgot password?
      </h1>
      <p className="mt-3 text-slate-500">
        Enter your email and we&apos;ll send you a 6-digit code to reset your
        password.
      </p>

      <form onSubmit={handleSubmit} className="mt-8">
        <label htmlFor="forgot-email" className="text-sm font-medium text-slate-900">
          Email
        </label>
        <div className="relative mt-1.5">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
            <MailIcon />
          </span>
          <input
            id="forgot-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            autoComplete="email"
            aria-describedby={error ? "forgot-password-error" : undefined}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {error && <FormError id="forgot-password-error" message={error} />}

        <button
          type="submit"
          disabled={submitting || !email}
          className="mt-6 w-full rounded-xl bg-gradient-to-b from-blue-500 to-blue-600 py-3.5 font-semibold text-white shadow-sm transition-colors enabled:hover:from-blue-600 enabled:hover:to-blue-700 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        >
          {submitting ? "Sending…" : "Send code"}
        </button>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => onSelectTab("signin")}
            className="rounded text-sm font-medium text-blue-600 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
          >
            Back to sign in
          </button>
        </div>
      </form>
    </div>
  );
}
