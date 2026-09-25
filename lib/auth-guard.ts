import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { validateSession } from "@/lib/session";
import type { User } from "@prisma/client";

/**
 * Server-side guard for routes that require a fully verified, signed-in
 * user (Dashboard, Account created). A client-side check would still ship
 * the protected page to the browser before redirecting; this runs during
 * the server render instead, so protected content is never sent at all.
 *
 * All auth screens live as views within the single /auth route (?view=...),
 * so a redirect to "sign in" or "verify email" means /auth?view=signin /
 * /auth?view=verify-email — Dashboard is the one screen that's still a real
 * separate route.
 *
 *  - no valid session               -> /auth?view=signin
 *  - valid session, emailVerified: false -> /auth?view=verify-email
 */
export async function requireVerifiedUser(): Promise<User> {
  const session = await validateSession();
  if (!session) {
    redirect("/auth?view=signin");
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || !user.emailVerified) {
    redirect("/auth?view=verify-email");
  }

  return user;
}

/**
 * Server-side guard for Verify email — the inverse of requireVerifiedUser():
 * this screen exists only for a signed-in account that hasn't verified yet.
 *
 *  - no valid session              -> /auth?view=signin
 *  - valid session, emailVerified: true -> /dashboard
 */
export async function requireUnverifiedUser(): Promise<User> {
  const session = await validateSession();
  if (!session) {
    redirect("/auth?view=signin");
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) {
    redirect("/auth?view=signin");
  }
  if (user.emailVerified) {
    redirect("/dashboard");
  }

  return user;
}
