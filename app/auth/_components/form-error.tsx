import type { ReactNode } from "react";

function AlertCircleIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.6" />
      <path d="M10 6.5V11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="10" cy="14" r="0.9" fill="currentColor" />
    </svg>
  );
}

interface FormErrorProps {
  /** id to reference via aria-describedby on the offending input(s). */
  id?: string;
  /** Copy; a ReactNode so the duplicate-email error can embed an inline link. */
  message: ReactNode;
}

// One shared error surface for the whole auth flow — a light red banner with
// an alert icon and red text — used for both field-level (under an input,
// with the input's aria-describedby pointing at it) and form-level (in each
// view's designated error slot, usually above the submit action) messages.
// Every view routes its error copy through here so the styling and the
// alert semantics can never drift from view to view.
export function FormError({ id, message }: FormErrorProps) {
  return (
    <p
      id={id}
      role="alert"
      className="flex items-start gap-2.5 rounded-xl bg-red-50 px-4 py-3"
    >
      <span className="mt-0.5 shrink-0 text-red-500">
        <AlertCircleIcon />
      </span>
      <span className="flex-1 text-sm font-medium text-red-700">{message}</span>
    </p>
  );
}
