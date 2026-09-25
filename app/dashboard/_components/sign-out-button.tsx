"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function SignOutIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true">
      <path
        d="M7.5 17H4.5a1.5 1.5 0 0 1-1.5-1.5v-11A1.5 1.5 0 0 1 4.5 3h3M13 14l4-4-4-4M17 10H7.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SignOutButton({ variant = "icon" }: { variant?: "icon" | "menu" }) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await fetch("/api/auth/signout", { method: "POST" });
    } finally {
      // Same-destination fallback either way — the session cookie is
      // cleared server-side regardless of whether this fetch succeeds.
      router.push("/auth?view=signin");
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={signingOut}
      aria-label="Sign out"
      title="Sign out"
      className={variant === "menu" ? "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left font-semibold text-slate-800 transition-colors hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1" : "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"}
    >
      <SignOutIcon />
      {variant === "menu" && <span>Sign out</span>}
    </button>
  );
}
