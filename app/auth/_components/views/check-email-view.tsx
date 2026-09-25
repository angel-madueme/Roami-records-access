"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { AuthTabs } from "../auth-tabs";
import { CodeInput, emptyCode } from "../code-input";
import { FormError } from "../form-error";

const RESEND_COOLDOWN_SECONDS = 60;
const EXPIRED_CODE_MESSAGE = "This code has expired. Request a new code.";

function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

interface CheckEmailViewProps {
  email: string;
  onSuccess: (proof: string) => void;
  onUseDifferentEmail: () => void;
  onSelectTab: (tab: "signup" | "signin") => void;
}

export function CheckEmailView({ email, onSuccess, onUseDifferentEmail, onSelectTab }: CheckEmailViewProps) {
  const [digits, setDigits] = useState<string[]>(emptyCode);
  const [focusSignal, setFocusSignal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);

  useEffect(() => {
    if (cooldown === 0) return;
    const id = setTimeout(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  function resetDigits() {
    setDigits(emptyCode());
    setFocusSignal((n) => n + 1);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const code = digits.join("");
    if (code.length !== 6) {
      setError("Enter all 6 digits.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/verify-reset-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        onSuccess(data.proof);
        return;
      }

      const message: string = data?.error ?? "Something went wrong. Try again.";
      setError(message);
      if (message !== EXPIRED_CODE_MESSAGE) {
        resetDigits();
      }
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0 || resending) return;

    setResending(true);
    setError(null);
    try {
      // No dedicated reset-code-resend endpoint/limit exists (PRD Section
      // 10 only defines "password-reset-request") — resending here just
      // means calling forgot-password again for the same email, which
      // already invalidates the prior code, issues a new one, and is
      // rate-limited at 5/email/hour.
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 429) {
        setCooldown(
          typeof data.retryAfterSeconds === "number" ? data.retryAfterSeconds : RESEND_COOLDOWN_SECONDS
        );
        setError(data.error ?? "Too many requests. Try again later.");
        return;
      }

      setCooldown(RESEND_COOLDOWN_SECONDS);
      resetDigits();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setResending(false);
    }
  }

  return (
    <div>
      <AuthTabs active="signin" onSelect={onSelectTab} />

      <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-slate-900">
        Check your email
      </h1>
      <p className="mt-3 text-slate-500">
        We sent a 6-digit code to {email}. Enter it below to continue.
      </p>

      <form onSubmit={handleSubmit} className="mt-8">
        <CodeInput
          digits={digits}
          onChange={setDigits}
          focusSignal={focusSignal}
          describedBy={error ? "check-email-error" : undefined}
        />

        {error && <FormError id="check-email-error" message={error} />}

        <div className="mt-4 flex items-center justify-between text-sm">
          {cooldown > 0 ? (
            <span className="text-slate-500">Resend code in {formatCountdown(cooldown)}</span>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={handleResend}
            disabled={cooldown > 0 || resending}
            className="rounded font-medium text-blue-600 underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
          >
            Resend code
          </button>
        </div>

        <button
          type="submit"
          disabled={submitting || digits.some((d) => !d)}
          className="mt-6 w-full rounded-xl bg-gradient-to-b from-blue-500 to-blue-600 py-3.5 font-semibold text-white shadow-sm transition-colors enabled:hover:from-blue-600 enabled:hover:to-blue-700 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        >
          {submitting ? "Verifying…" : "Continue"}
        </button>

        <div className="mt-6 flex flex-col items-center gap-2 text-center">
          <button
            type="button"
            onClick={onUseDifferentEmail}
            className="rounded text-sm font-medium text-blue-600 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
          >
            Use a different email
          </button>
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
