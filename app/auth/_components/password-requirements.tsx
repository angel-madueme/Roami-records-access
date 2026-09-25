import { PASSWORD_RULES } from "@/lib/validation/auth";

export { meetsPasswordRequirements } from "@/lib/validation/auth";

function CheckIcon({ met }: { met: boolean }) {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
      <path
        d="M3.5 8.5 6.5 11.5 12.5 4.5"
        fill="none"
        stroke={met ? "#15803d" : "#94a3b8"}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Live pass/fail pills for the password rules. The rule list is not defined
// here — it's PASSWORD_RULES (lib/validation/auth.ts), the same single source
// that drives passwordSchema server-side and meetsPasswordRequirements for the
// client submit gate, so the pills, the disabled button, and the API validation
// can never drift apart. `show` lets the parent hide the pills until the
// password field is focused or has content, instead of them flashing on load.
export function PasswordRequirements({ password, show }: { password: string; show: boolean }) {
  if (!show) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(password);
        return (
          <span
            key={rule.key}
            className={
              met
                ? "inline-flex items-center gap-1 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700"
                : "inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500"
            }
          >
            <CheckIcon met={met} />
            {rule.label}
          </span>
        );
      })}
    </div>
  );
}
