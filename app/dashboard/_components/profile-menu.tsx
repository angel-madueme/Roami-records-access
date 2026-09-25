"use client";

import { useEffect, useRef, useState } from "react";
import { SignOutButton } from "./sign-out-button";

function AvatarIcon() {
  return <svg viewBox="0 0 20 20" className="h-5 w-5 text-blue-500" fill="currentColor" aria-hidden="true"><circle cx="10" cy="7" r="3.2" /><path d="M3.5 17c0-3.3 2.9-5.5 6.5-5.5s6.5 2.2 6.5 5.5" /></svg>;
}

export function ProfileMenu({ fullName, email }: { fullName: string; email: string }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function closeOnOutsidePointer(event: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [open]);

  return (
    <div ref={menuRef} className="relative border-t border-slate-200 pt-4">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-white/70">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100"><AvatarIcon /></span>
        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-900">{fullName}</span><span className="block truncate text-xs text-slate-500">Free</span></span>
        <span className="text-xl text-slate-500" aria-hidden="true">›</span>
      </button>
      {open && <div className="absolute bottom-16 left-0 z-40 w-64 rounded-2xl border border-slate-100 bg-white p-3 shadow-xl shadow-slate-900/10"><div className="border-b border-slate-100 px-3 pb-3"><p className="truncate font-semibold text-slate-900">{fullName}</p><p className="truncate text-xs text-slate-500">{email}</p></div><div className="mt-1 border-t border-slate-100 pt-1"><SignOutButton variant="menu" /></div></div>}
    </div>
  );
}
