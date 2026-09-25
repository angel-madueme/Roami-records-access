import Link from "next/link";
import { SuccessIllustration } from "../success-illustration";

// No AuthTabs — matches the design reference, same as the original
// /signup/success page.
export function AccountCreatedView() {
  return (
    <div className="flex flex-col items-center text-center">
      <SuccessIllustration
        src="/images/illustrations/account-created.png.png"
        alt="Account created successfully"
      />

      <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">
        Account created
      </h1>
      <p className="mt-3 max-w-sm text-slate-500">
        Your Roami account is ready. Start planning destinations, stays, and
        activities in one place.
      </p>

      <Link
        href="/dashboard"
        className="mt-8 w-full rounded-xl bg-gradient-to-b from-blue-500 to-blue-600 py-3.5 text-center font-semibold text-white shadow-sm transition-colors enabled:hover:from-blue-600 enabled:hover:to-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
      >
        Go to dashboard
      </Link>

      <p className="mt-8 text-sm text-slate-500">
        You&apos;re all set to plan your first trip.
      </p>
    </div>
  );
}
