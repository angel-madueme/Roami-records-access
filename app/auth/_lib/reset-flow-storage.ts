const STORAGE_KEY = "roami:reset-flow";

interface ResetFlowState {
  email?: string;
  proof?: string;
}

// Carries state between the forgot-password screens client-side. There's no
// session at this point in the flow (the user isn't authenticated yet), so
// this can't live on the server — sessionStorage keeps it out of the URL
// (no email/proof in query params or browser history) and scoped to the tab.
export function readResetFlowState(): ResetFlowState {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ResetFlowState) : {};
  } catch {
    return {};
  }
}

export function writeResetFlowState(patch: ResetFlowState): void {
  if (typeof window === "undefined") return;
  const next = { ...readResetFlowState(), ...patch };
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function clearResetFlowState(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(STORAGE_KEY);
}
