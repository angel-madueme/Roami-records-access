import Image from "next/image";
import type { Metadata } from "next";
import { requireVerifiedUser, requireUnverifiedUser } from "@/lib/auth-guard";
import { AUTH_VIEW_TITLES, isAuthView, type AuthView } from "./_lib/auth-views";
import { AuthViewClient } from "./_components/auth-view-client";

interface AuthPageProps {
  searchParams: Promise<{ view?: string }>;
}

export async function generateMetadata({ searchParams }: AuthPageProps): Promise<Metadata> {
  const params = await searchParams;
  const view: AuthView = isAuthView(params.view) ? params.view : "signup";
  return { title: AUTH_VIEW_TITLES[view] };
}

export default async function AuthPage({ searchParams }: AuthPageProps) {
  const params = await searchParams;
  const view: AuthView = isAuthView(params.view) ? params.view : "signup";

  // Server-enforced on every hard navigation (typed URL, refresh, bookmark,
  // shared link) — these are the two views that require an authenticated
  // session, so this is where the guard genuinely has to live. Reuses the
  // exact same guard functions the dashboard uses (lib/auth-guard.ts);
  // only their redirect targets changed, from standalone routes to
  // /auth?view=... Client-side transitions into these views (from within
  // an already-mounted /auth) are always preceded by a just-succeeded API
  // call that proves the same thing — see auth-view-client.tsx.
  let initialUser: { email: string } | null = null;
  if (view === "account-created") {
    const user = await requireVerifiedUser();
    initialUser = { email: user.email };
  } else if (view === "verify-email") {
    const user = await requireUnverifiedUser();
    initialUser = { email: user.email };
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-12">
      <Image
        src="/images/sky-background.png"
        alt=""
        fill
        priority
        className="object-cover"
      />
      <span className="absolute left-6 top-6 z-10 text-2xl font-extrabold tracking-tight text-slate-900 sm:left-10 sm:top-10">
        Roami
      </span>
      <div className="relative z-10 w-full max-w-[560px] rounded-3xl bg-white p-10 shadow-xl shadow-slate-900/10 sm:p-12">
        <AuthViewClient initialView={view} initialUser={initialUser} />
      </div>
    </div>
  );
}
