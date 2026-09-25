"use client";

import { useEffect } from "react";

interface ToastProps {
  message: string;
  /** Auto-dismiss delay in milliseconds. */
  duration?: number;
  onDismiss: () => void;
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4 text-emerald-400" aria-hidden="true">
      <path
        d="M3.5 8.5 6.5 11.5 12.5 4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Small fixed-position notification banner (success toast), auto-dismissing
// after `duration` ms. Render it conditionally from a view; onDismiss hides it.
export function Toast({ message, duration = 4000, onDismiss }: ToastProps) {
  useEffect(() => {
    const id = setTimeout(onDismiss, duration);
    return () => clearTimeout(id);
  }, [duration, onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-8 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-medium text-white shadow-xl"
    >
      <CheckIcon />
      {message}
    </div>
  );
}