"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { readResetFlowState, writeResetFlowState, clearResetFlowState } from "../_lib/reset-flow-storage";
import { AUTH_VIEW_TITLES, type AuthView } from "../_lib/auth-views";
import { emailSchema } from "@/lib/validation/auth";
import { SignupView } from "./views/signup-view";
import { SigninView } from "./views/signin-view";
import { VerifyEmailView } from "./views/verify-email-view";
import { AccountCreatedView } from "./views/account-created-view";
import { ForgotPasswordView } from "./views/forgot-password-view";
import { CheckEmailView } from "./views/check-email-view";
import { CreateNewPasswordView } from "./views/create-new-password-view";
import { ResetSuccessView } from "./views/reset-success-view";

interface AuthUser {
  email: string;
}

interface AuthViewClientProps {
  initialView: AuthView;
  /**
   * Only populated when the initial view required a server-side guard
   * (verify-email, account-created) — see app/auth/page.tsx. Other views
   * don't need it on first load; they pick it up from their own API calls.
   */
  initialUser: AuthUser | null;
}

// Owns which auth view is showing and switches between them entirely
// client-side (no full navigation/page reload) — the URL is kept in sync
// via router.replace so every view stays bookmarkable/shareable, but
// replace (not push) means the browser back button exits /auth rather than
// stepping back through intermediate views. See DOCUMENTATION.md Section 5,
// "Page architecture," for the full tradeoff.
export function AuthViewClient({ initialView, initialUser }: AuthViewClientProps) {
  const router = useRouter();
  const [view, setViewState] = useState<AuthView>(initialView);
  const [user, setUser] = useState<AuthUser | null>(initialUser);
  const [resetEmail, setResetEmail] = useState<string | null>(null);
  const [resetProof, setResetProof] = useState<string | null>(null);
  const [resetFlowLoaded, setResetFlowLoaded] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  // The last email typed in whichever of Sign up / Sign in is currently
  // mounted, reported by the view on every keystroke so it survives a
  // client-side switch to the other panel. At switch time we only carry it
  // when the currently held value is correctly-formatted and non-empty —
  // this is a field pre-fill, never a statement about whether an account
  // exists (PRD §6's anti-enumeration copy stays untouched).
  const [carriedEmail, setCarriedEmail] = useState("");
  const carriedValid = emailSchema.safeParse(carriedEmail).success;
  // Holds the email typed in whichever of Sign up / Sign in is currently
  // mounted, so it can be carried over when the user switches panels. The
  // value is only ever surfaced as a field pre-fill (never as a claim about
  // whether an account exists) — see the carryEmailSeed helper below.

  // Every view gets its own document title, kept in sync on client-side
  // switches (generateMetadata in app/auth/page.tsx covers hard loads).
  useEffect(() => {
    document.title = AUTH_VIEW_TITLES[view];
  }, [view]);

  function goToView(next: AuthView) {
    setViewState(next);
    router.replace(`/auth?view=${next}`, { scroll: false });
  }

  function updateResetFlow(patch: { email?: string; proof?: string }) {
    writeResetFlowState(patch);
    if (patch.email !== undefined) setResetEmail(patch.email);
    if (patch.proof !== undefined) setResetProof(patch.proof);
  }

  function finishResetFlow() {
    clearResetFlowState();
    setResetEmail(null);
    setResetProof(null);
  }

  function revealForgotPassword(email: string) {
    setForgotEmail(emailSchema.safeParse(email).success ? email : "");
    goToView("forgot-password");
  }

  function onSelectTab(tab: "signup" | "signin") {
    goToView(tab);
  }

  // sessionStorage is only available client-side, so this read has to
  // happen post-mount — an effect is the correct tool here, not a lint
  // false positive (see reset-flow-storage.ts).
  useEffect(() => {
    const state = readResetFlowState();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setResetEmail(state.email ?? null);
    setResetProof(state.proof ?? null);
    setResetFlowLoaded(true);
  }, []);

  // Client-side guard for the two reset-flow views. This was never
  // server-enforceable even before this refactor — there's no session at
  // this point in the flow. The real enforcement is verify-reset-code /
  // reset-password re-checking the proof server-side on every call,
  // regardless of what the UI currently shows.
  useEffect(() => {
    if (!resetFlowLoaded) return;
    if (view === "check-email" && !resetEmail) {
      // Legitimate post-mount state correction: the stored email/proof only
      // becomes known once sessionStorage is read (in the effect above).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      goToView("forgot-password");
    }
    if (view === "create-new-password" && !resetProof) {
      goToView("forgot-password");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, resetFlowLoaded, resetEmail, resetProof]);

  switch (view) {
    case "signup":
      return (
        <SignupView
          initialEmail={carriedValid ? carriedEmail : undefined}
          onEmailChange={setCarriedEmail}
          onSuccess={(u) => {
            setUser(u);
            goToView("verify-email");
          }}
          onSwitchToSignin={() => goToView("signin")}
        />
      );

    case "signin":
      return (
        <SigninView
          initialEmail={carriedValid ? carriedEmail : undefined}
          onEmailChange={setCarriedEmail}
          onUnverifiedSuccess={(u) => {
            setUser({ email: u.email });
            goToView("verify-email");
          }}
          onSwitchToSignup={() => goToView("signup")}
          onForgotPassword={revealForgotPassword}
        />
      );

    case "verify-email":
      // Guarded server-side on hard load (app/auth/page.tsx); on client
      // transitions user is always set by the preceding signup/signin call.
      if (!user) return null;
      return (
        <VerifyEmailView
          email={user.email}
          onSuccess={() => goToView("account-created")}
          onChangeEmail={() => goToView("signup")}
          onSelectTab={onSelectTab}
        />
      );

    case "account-created":
      if (!user) return null;
      return <AccountCreatedView />;

    case "forgot-password":
      return (
        <ForgotPasswordView
          initialEmail={forgotEmail}
          onSubmitted={(email) => {
            updateResetFlow({ email });
            goToView("check-email");
          }}
          onSelectTab={onSelectTab}
        />
      );

    case "check-email":
      if (!resetEmail) return null;
      return (
        <CheckEmailView
          email={resetEmail}
          onSuccess={(proof) => {
            updateResetFlow({ proof });
            goToView("create-new-password");
          }}
          onUseDifferentEmail={() => {
            setForgotEmail("");
            goToView("forgot-password");
          }}
          onSelectTab={onSelectTab}
        />
      );

    case "create-new-password":
      if (!resetProof) return null;
      return (
        <CreateNewPasswordView
          proof={resetProof}
          onSuccess={() => {
            finishResetFlow();
            goToView("reset-success");
          }}
          onSelectTab={onSelectTab}
        />
      );

    case "reset-success":
      return <ResetSuccessView onGoToSignin={() => goToView("signin")} />;
  }
}