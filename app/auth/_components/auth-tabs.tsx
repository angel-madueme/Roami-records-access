"use client";

type AuthTab = "signup" | "signin";

const TABS: { key: AuthTab; label: string }[] = [
  { key: "signup", label: "Sign up" },
  { key: "signin", label: "Sign in" },
];

// Segmented Sign up / Sign in switcher shown at the top of several auth
// views. Calls onSelect (an AuthViewClient view transition) rather than
// navigating — signup/signin are views within /auth now, not separate
// routes. Account created, Dashboard, and Reset success don't use it.
//
// The active state is a single white pill that glides between the two tabs
// via a transform transition, so the buttons themselves stay transparent.
// The view switch below remains instant (AuthViewClient just swaps state);
// this motion belongs only to the tab indicator, not the form.
export function AuthTabs({ active, onSelect }: { active: AuthTab; onSelect: (tab: AuthTab) => void }) {
  return (
    <div className="relative flex rounded-full bg-slate-100 p-1">
      <span
        aria-hidden="true"
        className={`absolute inset-y-1 left-1 w-[calc(50%_-_4px)] rounded-full bg-white shadow-sm transition-transform duration-300 ease-in-out motion-reduce:transition-none ${
          active === "signin" ? "translate-x-full" : "translate-x-0"
        }`}
      />
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onSelect(tab.key)}
            aria-current={isActive ? "page" : undefined}
            className={`relative flex-1 rounded-full py-2.5 text-center text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
              isActive
                ? "font-semibold text-blue-600"
                : "font-medium text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}