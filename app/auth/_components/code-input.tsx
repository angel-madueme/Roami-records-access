"use client";

import { useEffect, useRef } from "react";
import type { ChangeEvent, ClipboardEvent, KeyboardEvent } from "react";

export const CODE_LENGTH = 6;

export function emptyCode(): string[] {
  return Array(CODE_LENGTH).fill("");
}

interface CodeInputProps {
  digits: string[];
  onChange: (digits: string[]) => void;
  /** Bump this value to force focus back to the first box (e.g. after a reset/resend). */
  focusSignal?: number;
  disabled?: boolean;
  /** id of an error/description element to associate via aria-describedby. */
  describedBy?: string;
}

// Six individual digit boxes shared by every code-entry screen (email
// verification, password-reset code step): numeric-only, auto-advances on
// entry, backspace on an empty box moves focus back, and pasting a full
// code into any box distributes it across all six.
export function CodeInput({ digits, onChange, focusSignal, disabled, describedBy }: CodeInputProps) {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (focusSignal !== undefined) {
      inputRefs.current[0]?.focus();
    }
  }, [focusSignal]);

  function focusInput(index: number) {
    inputRefs.current[index]?.focus();
  }

  function handleChange(index: number, e: ChangeEvent<HTMLInputElement>) {
    const value = e.target.value.replace(/\D/g, "");

    if (!value) {
      const next = [...digits];
      next[index] = "";
      onChange(next);
      return;
    }

    const char = value[value.length - 1];
    const next = [...digits];
    next[index] = char;
    onChange(next);

    if (index < CODE_LENGTH - 1) {
      focusInput(index + 1);
    }
  }

  function handleKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      e.preventDefault();
      const next = [...digits];
      next[index - 1] = "";
      onChange(next);
      focusInput(index - 1);
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, CODE_LENGTH);
    if (!pasted) return;
    e.preventDefault();

    const next = emptyCode();
    for (let i = 0; i < pasted.length; i++) {
      next[i] = pasted[i];
    }
    onChange(next);
    focusInput(Math.min(pasted.length, CODE_LENGTH) - 1);
  }

  return (
    <fieldset className="flex justify-between gap-2 sm:gap-3" disabled={disabled}>
      <legend className="sr-only">6-digit code</legend>
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            inputRefs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={1}
          value={digit}
          aria-label={`Digit ${i + 1} of 6`}
          aria-describedby={describedBy}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          className="h-14 w-12 rounded-xl border border-slate-200 bg-slate-50 text-center text-xl font-semibold text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 sm:h-16 sm:w-14 disabled:opacity-60"
        />
      ))}
    </fieldset>
  );
}
