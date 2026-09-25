"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { AuthTabs } from "../auth-tabs";
import { CodeInput, emptyCode } from "../code-input";
import { FormError } from "../form-error";
import { Toast } from "../toast";

const RESEND_COOLDOWN_SECONDS = 60;
const EXPIRED_CODE_MESSAGE = "This code has expired. Request a new code.";
const NETWORK_ERROR_MESSAGE = "Something went wrong. Please try again.";

function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

interface VerifyEmailViewProps {
  email: string;
  onSuccess: () => void;
  onChangeEmail: () => void;
  onSelectTab: (tab: "signup" | "signin") => void;
}

export function VerifyEmailView({ email, onSuccess, onChangeEmail, onSelectTab }: VerifyEmailViewProps) {
  const [digits, setDigits] = useState<string[]>(emptyCode);
  const [focusSignal, setFocusSignal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  // The first code was already sent before this view was ever reached (at
  // signup, or at the signin "unverified account" branch) — so the cooldown
  // starts counting immediately on mount, matching the design reference.
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
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        onSuccess();
        return;
      }

      // Incorrect and expired codes come back verbatim from the server, so
      // the exact copy is guaranteed to match; anything else (a dropped
      // session, an unexpected failure) surfaces as the generic network
      // message instead of leaking an internal string.
      const message =
        res.status === 400 && typeof data?.error === "string"
          ? data.error
          : NETWORK_ERROR_MESSAGE;
      setError(message);
      // An expired code is fixed by requesting a new one — leave the digits
      // in place. Every other failed attempt clears the boxes to retry.
      if (message !== EXPIRED_CODE_MESSAGE) {
        resetDigits();
      }
    } catch {
      setError(NETWORK_ERROR_MESSAGE);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0 || resending) return;

    setResending(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/resend-verification", { method: "POST" });
      const data = await res.json().catch(() => ({}));

      if (res.status === 429) {
        const retryAfterSeconds =
          typeof data.retryAfterSeconds === "number" ? data.retryAfterSeconds : RESEND_COOLDOWN_SECONDS;
        // A remaining cooldown that's still within the normal 60s window is
        // the existing countdown UI re-arming — no error needed. Only a
        // longer wait (the 5/hour cap per PRD Section 10) surfaces the
        // hard-cap message.
        if (retryAfterSeconds <= RESEND_COOLDOWN_SECONDS) {
          setCooldown(retryAfterSeconds);
        } else {
          setError("You've requested too many codes. Try again in an hour.");
          setCooldown(RESEND_COOLDOWN_SECONDS);
        }
        return;
      }
      if (!res.ok) {
        setError(NETWORK_ERROR_MESSAGE);
        return;
      }

      setCooldown(RESEND_COOLDOWN_SECONDS);
      resetDigits();
      setToastVisible(true);
    } catch {
      setError(NETWORK_ERROR_MESSAGE);
    } finally {
      setResending(false);
    }
  }

  return (
    <div>
      <AuthTabs active="signup" onSelect={onSelectTab} />

      <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-slate-900">
        Verify your email
      </h1>
      <p className="mt-3 text-slate-500">
        We sent a 6-digit code to {email}. Enter it below to verify your
        account.
      </p>

      <form onSubmit={handleSubmit} className="mt-8">
        <CodeInput
          digits={digits}
          onChange={(next) => {
            setDigits(next);
            setError(null);
          }}
          focusSignal={focusSignal}
          describedBy={error ? "verify-email-error" : undefined}
        />

        {error && (
          <div className="mt-3">
            <FormError id="verify-email-error" message={error} />
          </div>
        )}

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
          {submitting ? "Verifying…" : "Verify email"}
        </button>

        <p className="mt-6 text-center text-sm text-slate-500">
          Wrong email?{" "}
          <button
            type="button"
            onClick={onChangeEmail}
            className="rounded font-medium text-blue-600 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
          >
            Change email
          </button>
        </p>
      </form>

      {toastVisible && (
        <Toast
          message="A new verification code has been sent to your email"
          onDismiss={() => setToastVisible(false)}
        />
      )}
    </div>
  );
}
