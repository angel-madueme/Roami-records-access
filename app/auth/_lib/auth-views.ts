// Plain module (no "use client") so the server page component can call
// isAuthView() directly — a function exported from a "use client" file
// can't be invoked from server code, only rendered as a component.
export const AUTH_VIEWS = [
  "signup",
  "signin",
  "verify-email",
  "account-created",
  "forgot-password",
  "check-email",
  "create-new-password",
  "reset-success",
] as const;
export type AuthView = (typeof AUTH_VIEWS)[number];

export function isAuthView(value: string | undefined): value is AuthView {
  return !!value && (AUTH_VIEWS as readonly string[]).includes(value);
}

// Per-view document titles, used by AuthViewClient's effect on every client
// switch and by app/auth/page.tsx's generateMetadata for hard loads.
export const AUTH_VIEW_TITLES: Record<AuthView, string> = {
  signup: "Create your account – Roami",
  signin: "Sign in – Roami",
  "verify-email": "Verify your email – Roami",
  "account-created": "Account created – Roami",
  "forgot-password": "Forgot password – Roami",
  "check-email": "Check your email – Roami",
  "create-new-password": "Create new password – Roami",
  "reset-success": "Password reset – Roami",
};
