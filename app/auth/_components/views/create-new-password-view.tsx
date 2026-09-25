"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { AuthTabs } from "../auth-tabs";
import { PasswordField } from "../password-field";
import { PasswordRequirements, meetsPasswordRequirements } from "../password-requirements";
import { FormError } from "../form-error";

interface CreateNewPasswordViewProps {
  proof: string;
  onSuccess: () => void;
  onSelectTab: (tab: "signup" | "signin") => void;
}

export function CreateNewPasswordView({ proof, onSuccess, onSelectTab }: CreateNewPasswordViewProps) {
  const [password, setPassword] = useState("");
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = meetsPasswordRequirements(password) && confirmPassword.length > 0;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proof, newPassword: password }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.error ?? "Something went wrong. Try again.");
        return;
      }

      onSuccess();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <AuthTabs active="signin" onSelect={onSelectTab} />

      <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-slate-900">
        Create new password
      </h1>
      <p className="mt-3 text-slate-500">
        Your new password must be different from your previous password.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
        <div>
          <PasswordField
            id="new-password"
            label="New password"
            placeholder="Create a new password"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            onFocus={() => setPasswordFocused(true)}
            onBlur={() => setPasswordFocused(false)}
          />
          <PasswordRequirements password={password} show={passwordFocused || password.length > 0} />
        </div>

        <PasswordField
          id="confirm-password"
          label="Confirm password"
          placeholder="Confirm your password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          autoComplete="new-password"
          describedBy={error ? "create-new-password-error" : undefined}
        />

        {error && <FormError id="create-new-password-error" message={error} />}

        <button
          type="submit"
          disabled={submitting || !canSubmit}
          className="w-full rounded-xl bg-gradient-to-b from-blue-500 to-blue-600 py-3.5 font-semibold text-white shadow-sm transition-colors enabled:hover:from-blue-600 enabled:hover:to-blue-700 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        >
          {submitting ? "Resetting…" : "Reset password"}
        </button>

        <div className="text-center">
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
