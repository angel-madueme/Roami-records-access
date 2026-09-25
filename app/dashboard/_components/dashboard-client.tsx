"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ItineraryModal } from "./itinerary-modal";
import { ProfileMenu } from "./profile-menu";
import { SavedPlacesClient } from "./saved-places-client";

function HomeIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" aria-hidden="true">
      <path
        d="M3 9.5 10 3l7 6.5M5 8v8h10V8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TripsIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" aria-hidden="true">
      <rect x="3" y="7" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M7 7V5.5A1.5 1.5 0 0 1 8.5 4h3A1.5 1.5 0 0 1 13 5.5V7"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function SavedPlacesIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" aria-hidden="true">
      <path
        d="M10 17S3.5 12.4 3.5 7.9A3.4 3.4 0 0 1 10 6a3.4 3.4 0 0 1 6.5 1.9C16.5 12.4 10 17 10 17Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="2.6" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M10 2.5v2M10 15.5v2M17.5 10h-2M4.5 10h-2M15.3 4.7l-1.4 1.4M6.1 13.9l-1.4 1.4M15.3 15.3l-1.4-1.4M6.1 6.1 4.7 4.7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function DashboardClient({ fullName, email }: { fullName: string; email: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [itineraryOpen, setItineraryOpen] = useState(false);
  const firstName = fullName.trim().split(/\s+/)[0] ?? fullName;
  const savedPlacesOpen = searchParams.get("view") === "saved-places";

  return (
    <div className="relative flex min-h-screen items-center justify-center p-4 sm:p-8">
      <Image
        src="/images/sky-background.png"
        alt=""
        fill
        priority
        className="object-cover"
      />

      <div className="relative z-10 flex h-[min(880px,calc(100vh-4rem))] w-full max-w-6xl overflow-hidden rounded-3xl bg-white shadow-xl shadow-slate-900/10">
        {/* Sidebar navigation remains visual-only; the profile menu and sign-out action are functional. */}
        <aside className="flex w-64 shrink-0 flex-col justify-between border-r border-slate-100 bg-slate-50/60 p-6 sm:w-72">
          <div>
            <span className="text-xl font-extrabold tracking-tight text-slate-900">Roami</span>

            <nav className="mt-8 flex flex-col gap-1">
              <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-slate-500">
                <HomeIcon />
                <span className="text-sm font-medium">Home</span>
              </div>
              <div className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${savedPlacesOpen ? "text-slate-500" : "bg-blue-50 text-blue-600"}`}>
                <TripsIcon />
                <span className={`text-sm ${savedPlacesOpen ? "font-medium" : "font-semibold"}`}>Trips</span>
              </div>
              <button
                type="button"
                onClick={() => router.replace("/dashboard?view=saved-places", { scroll: false })}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${savedPlacesOpen ? "bg-blue-50 text-blue-600" : "text-slate-500 hover:bg-slate-100"}`}
              >
                <SavedPlacesIcon />
                <span className={`text-sm ${savedPlacesOpen ? "font-semibold" : "font-medium"}`}>Saved places</span>
              </button>
              <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-slate-500">
                <SettingsIcon />
                <span className="text-sm font-medium">Settings</span>
              </div>
            </nav>
          </div>

          <ProfileMenu fullName={fullName} email={email} />
        </aside>

        {/* Main area */}
        <main className="flex-1 overflow-y-auto p-8 sm:p-10">
          {savedPlacesOpen ? (
            <SavedPlacesClient />
          ) : (
            <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
                Good morning, {firstName} ✈️
              </h1>
              <p className="mt-1 text-slate-500">Start planning your next getaway.</p>
            </div>
          </div>

          <div className="mt-8 flex flex-col items-center rounded-2xl border border-slate-100 px-6 py-16 text-center">
            <div className="relative h-40 w-56">
              <Image
                src="/images/illustrations/empty-trips.png.png"
                alt="Illustration of a suitcase and map for trip planning"
                fill
                className="object-contain"
              />
            </div>
            <h2 className="mt-4 text-xl font-bold text-slate-900">No trips planned yet</h2>
            <p className="mt-2 max-w-md text-slate-500">
              Create your first trip to keep your destination, stay, and
              activities in one place.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                className="rounded-xl bg-gradient-to-b from-blue-500 to-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors enabled:hover:from-blue-600 enabled:hover:to-blue-700"
              >
                Plan your first trip
              </button>
              <button
                type="button"
                onClick={() => setItineraryOpen(true)}
                className="rounded-xl border border-blue-500 bg-white px-6 py-3 text-sm font-semibold text-blue-600 shadow-sm transition-colors hover:bg-blue-50"
              >
                Create from notes
              </button>
            </div>
          </div>
            </>
          )}
        </main>
      </div>
      <ItineraryModal open={itineraryOpen} onClose={() => setItineraryOpen(false)} />
    </div>
  );
}
