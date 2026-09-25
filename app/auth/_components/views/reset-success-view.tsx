import { SuccessIllustration } from "../success-illustration";

// No AuthTabs — matches the design reference, same as the original
// /reset-password/success page.
export function ResetSuccessView({ onGoToSignin }: { onGoToSignin: () => void }) {
  return (
    <div className="flex flex-col items-center text-center">
      <SuccessIllustration
        src="/images/illustrations/password-reset-successful.png.png"
        alt="Password reset successful"
      />

      <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">
        Password reset successful
      </h1>
      <p className="mt-3 max-w-sm text-slate-500">
        Your password has been updated successfully. You can now sign in to
        continue planning your trips.
      </p>

      <button
        type="button"
        onClick={onGoToSignin}
        className="mt-8 w-full rounded-xl bg-gradient-to-b from-blue-500 to-blue-600 py-3.5 text-center font-semibold text-white shadow-sm transition-colors enabled:hover:from-blue-600 enabled:hover:to-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
      >
        Go to sign in
      </button>
    </div>
  );
}
