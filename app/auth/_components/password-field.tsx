"use client";

import { useState } from "react";

function LockIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" aria-hidden="true">
      <rect x="4.5" y="9" width="11" height="8" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M6.5 9V6.5a3.5 3.5 0 0 1 7 0V9" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function EyeIcon({ visible }: { visible: boolean }) {
  if (visible) {
    return (
      <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" aria-hidden="true">
        <path
          d="M2 4l16 12M8.3 8.4A2.8 2.8 0 0 0 10 12.8c.7 0 1.3-.2 1.8-.6M6 5.7C7.2 5.1 8.5 4.8 10 4.8c3.8 0 6.8 2.3 8 5.2-.5 1.2-1.3 2.3-2.2 3.1M4 7.6C3 8.6 2.3 9.8 2 10c1.2 2.9 4.2 5.2 8 5.2 1 0 1.9-.2 2.7-.4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" aria-hidden="true">
      <path
        d="M2 10c1.2-2.9 4.2-5.2 8-5.2s6.8 2.3 8 5.2c-1.2 2.9-4.2 5.2-8 5.2S3.2 12.9 2 10Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="10" cy="10" r="2.6" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

interface PasswordFieldProps {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  /** id of an error/description element to associate via aria-describedby. */
  describedBy?: string;
  onFocus?: () => void;
  onBlur?: () => void;
}

// Password input with a lock icon and a show/hide toggle, shared by any
// screen that collects a password (create-new-password here; sign up and
// sign in, once built).
export function PasswordField({
  id,
  label,
  placeholder,
  value,
  onChange,
  autoComplete,
  describedBy,
  onFocus,
  onBlur,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-slate-900">
        {label}
      </label>
      <div className="relative mt-1.5">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
          <LockIcon />
        </span>
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-describedby={describedBy}
          onFocus={onFocus}
          onBlur={onBlur}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-11 text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded text-slate-400 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
        >
          <EyeIcon visible={visible} />
        </button>
      </div>
    </div>
  );
}
