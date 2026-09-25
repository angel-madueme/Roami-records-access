"use client";

import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type SavedPlaceStatus = "WISHLIST" | "PLANNED" | "VISITED";

interface SavedPlace {
  publicId: string;
  destination: string;
  note: string | null;
  unsplashImageUrl: string | null;
  unsplashPhotographerName: string | null;
  unsplashPhotographerUrl: string | null;
  status: SavedPlaceStatus;
  createdAt: string;
  updatedAt: string;
}

const statusLabels: Record<SavedPlaceStatus, string> = {
  WISHLIST: "Wishlist",
  PLANNED: "Planned",
  VISITED: "Visited",
};

const cardGradients = [
  "from-blue-200 via-sky-100 to-amber-100",
  "from-sky-200 via-blue-100 to-slate-100",
  "from-cyan-200 via-sky-100 to-emerald-100",
  "from-orange-200 via-amber-100 to-rose-100",
  "from-violet-200 via-slate-100 to-blue-100",
  "from-emerald-200 via-cyan-100 to-sky-100",
];

function CloseIcon() {
  return <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
}

function PlusIcon() {
  return <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" aria-hidden="true"><path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
}

function HeartIcon({ filled = false }: { filled?: boolean }) {
  return <svg viewBox="0 0 20 20" className="h-4 w-4" fill={filled ? "currentColor" : "none"} aria-hidden="true"><path d="M10 17S3.5 12.4 3.5 7.9A3.4 3.4 0 0 1 10 6a3.4 3.4 0 0 1 6.5 1.9C16.5 12.4 10 17 10 17Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>;
}

function CalendarIcon() {
  return <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true"><rect x="3.5" y="4.5" width="13" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" /><path d="M6.5 3v3M13.5 3v3M3.5 8h13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>;
}

function StarIcon() {
  return <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true"><path d="m10 2.8 2.1 4.4 4.9.7-3.5 3.4.8 4.8-4.3-2.3-4.3 2.3.8-4.8L3 7.9l4.9-.7L10 2.8Z" /></svg>;
}

function TrashIcon() {
  return <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true"><path d="M5 7h14M9 7V4h6v3m-8 0 1 13h6l1-13M10 10v7M14 10v7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function PinIcon() {
  return <svg viewBox="0 0 48 48" className="h-16 w-16 text-white/80" fill="none" aria-hidden="true"><path d="M24 43s12-13 12-23A12 12 0 1 0 12 20c0 10 12 23 12 23Z" fill="currentColor" opacity=".9" /><circle cx="24" cy="19" r="4.5" fill="#3b82f6" /></svg>;
}

function statusClass(status: SavedPlaceStatus) {
  if (status === "PLANNED") return "bg-emerald-50 text-emerald-600";
  if (status === "VISITED") return "bg-violet-50 text-violet-600";
  return "bg-blue-50 text-blue-600";
}

function StatusBadge({ status }: { status: SavedPlaceStatus }) {
  return <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${statusClass(status)}`}>{status === "PLANNED" ? <CalendarIcon /> : status === "VISITED" ? <StarIcon /> : <HeartIcon filled />}{statusLabels[status]}</span>;
}

function PhotoPanel({ place, detail = false }: { place: SavedPlace; detail?: boolean }) {
  if (!place.unsplashImageUrl) return null;
  const hasAttribution = Boolean(place.unsplashPhotographerName && place.unsplashPhotographerUrl);
  return <div className={`relative overflow-hidden ${detail ? "mt-8 h-52 rounded-2xl" : "h-36"}`}>
    {/* Unsplash URLs are runtime data, so a native image avoids expanding next.config for each remote host. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={place.unsplashImageUrl} alt={`Photo of ${place.destination}`} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
    {hasAttribution && <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/75 to-transparent px-3 pb-2 pt-7 text-[10px] text-white/90">
      Photo by <a href={place.unsplashPhotographerUrl ?? undefined} target="_blank" rel="noreferrer" className="font-semibold underline">{place.unsplashPhotographerName}</a> on <a href="https://unsplash.com" target="_blank" rel="noreferrer" className="font-semibold underline">Unsplash</a>
    </div>}
  </div>;
}

function ModalShell({ children, labelledBy, onClose, wide = false }: { children: React.ReactNode; labelledBy: string; onClose: () => void; wide?: boolean }) {
  return <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/25 p-4 backdrop-blur-sm sm:p-8" role="presentation"><div className={`relative max-h-[calc(100vh-2rem)] w-full overflow-y-auto rounded-[2rem] bg-white p-7 shadow-2xl shadow-slate-900/20 sm:p-10 ${wide ? "max-w-3xl" : "max-w-xl"}`} role="dialog" aria-modal="true" aria-labelledby={labelledBy}><button type="button" onClick={onClose} aria-label="Close" className="absolute right-6 top-6 rounded-full bg-slate-100 p-3 text-slate-700 transition hover:bg-slate-200"><CloseIcon /></button>{children}</div></div>;
}

function ErrorMessage({ message }: { message: string }) {
  return <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{message}</p>;
}

function CreateModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => Promise<void> }) {
  const [destination, setDestination] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<SavedPlaceStatus>("WISHLIST");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const response = await fetch("/api/saved-places", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ destination, note, status }) });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "We couldn't save this place.");
      }
      await onSaved();
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "We couldn't save this place.");
    } finally {
      setSaving(false);
    }
  }

  return <ModalShell labelledBy="create-saved-place-title" onClose={onClose}><h2 id="create-saved-place-title" className="pr-14 text-4xl font-extrabold tracking-tight text-slate-950">Save a place</h2><p className="mt-2 text-lg text-slate-500">Add a destination you&apos;re thinking about.</p><form onSubmit={handleSubmit} className="mt-10 space-y-7"><label className="block"><span className="text-lg font-bold text-slate-900">Destination name</span><input value={destination} onChange={(event) => setDestination(event.target.value)} required placeholder="e.g. Kyoto, Japan" className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-5 py-4 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100" /></label><label className="block"><span className="text-lg font-bold text-slate-900">Note <span className="font-normal text-slate-400">(optional)</span></span><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Why do you want to go here?" rows={3} className="mt-3 w-full resize-y rounded-2xl border border-slate-200 bg-slate-50/50 px-5 py-4 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100" /></label><fieldset><legend className="text-lg font-bold text-slate-900">Status</legend><div className="mt-3 grid grid-cols-3 overflow-hidden rounded-full border border-slate-200 bg-slate-50/50">{(["WISHLIST", "PLANNED", "VISITED"] as SavedPlaceStatus[]).map((option) => <label key={option} className={`flex cursor-pointer items-center justify-center gap-2 px-3 py-4 text-sm font-semibold transition ${status === option ? "bg-blue-100 text-blue-700" : "text-slate-700 hover:bg-slate-100"}`}><input type="radio" name="status" value={option} checked={status === option} onChange={() => setStatus(option)} className="h-4 w-4 accent-blue-600" />{statusLabels[option]}</label>)}</div></fieldset>{error && <ErrorMessage message={error} />}<div className="flex justify-end gap-3 border-t border-slate-100 pt-6"><button type="button" onClick={onClose} className="rounded-2xl bg-slate-100 px-7 py-3.5 font-semibold text-slate-700 transition hover:bg-slate-200">Cancel</button><button type="submit" disabled={saving} className="rounded-2xl bg-blue-600 px-8 py-3.5 font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60">{saving ? "Saving..." : "Save"}</button></div></form></ModalShell>;
}

function DetailModal({ place, error, onClose, onDelete }: { place: SavedPlace | null; error: string | null; onClose: () => void; onDelete: () => void }) {
  return <ModalShell labelledBy="saved-place-detail-title" onClose={onClose} wide><h2 id="saved-place-detail-title" className="pr-14 text-4xl font-extrabold tracking-tight text-slate-950">{place?.destination ?? "Saved place"}</h2>{error ? <div className="mt-10 space-y-5"><ErrorMessage message={error} /><button type="button" onClick={onClose} className="rounded-2xl bg-slate-100 px-7 py-3.5 font-semibold text-slate-700 transition hover:bg-slate-200">Back to saved places</button></div> : !place ? <div className="mt-10 flex items-center gap-3 text-slate-500"><span className="wave-spinner"><i /><i /><i /></span>Loading saved place...</div> : <><div className="mt-6"><StatusBadge status={place.status} /></div><PhotoPanel place={place} detail /><div className="mt-10"><h3 className="text-lg font-bold text-slate-500">Note</h3><div className="mt-3 min-h-32 rounded-2xl border border-slate-200 bg-slate-50/60 px-6 py-5 text-lg leading-8 text-slate-800">{place.note || "No note added for this place."}</div></div><div className="mt-8 flex justify-end"><button type="button" onClick={onDelete} className="inline-flex items-center gap-3 rounded-2xl bg-red-600 px-10 py-4 text-lg font-bold text-white shadow-lg shadow-red-500/20 transition hover:bg-red-700"><TrashIcon />Delete</button></div></>}</ModalShell>;
}

function DeleteModal({ place, onClose, onDeleted }: { place: SavedPlace | null; onClose: () => void; onDeleted: () => Promise<void> }) {
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!place) return;
    setDeleting(true);
    setError(null);
    try {
      const response = await fetch(`/api/saved-places/${encodeURIComponent(place.publicId)}`, { method: "DELETE" });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "We couldn't delete this place.");
      }
      await onDeleted();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "We couldn't delete this place.");
      setDeleting(false);
    }
  }

  return <ModalShell labelledBy="delete-saved-place-title" onClose={onClose}><div className="pr-8 text-center sm:px-4"><h2 id="delete-saved-place-title" className="text-3xl font-extrabold tracking-tight text-slate-950">Delete this saved place?</h2><p className="mt-5 text-lg leading-8 text-slate-500">This can&apos;t be undone. <span className="font-semibold text-slate-700">{place?.destination ?? "This place"}</span> will be removed from your saved places.</p>{error && <div className="mt-5 text-left"><ErrorMessage message={error} /></div>}<div className="mt-8 grid grid-cols-2 gap-3"><button type="button" onClick={onClose} disabled={deleting} className="rounded-2xl border border-slate-200 bg-white px-5 py-4 font-bold text-slate-800 transition hover:bg-slate-50 disabled:opacity-60">Cancel</button><button type="button" onClick={handleDelete} disabled={deleting || !place} className="rounded-2xl bg-red-600 px-5 py-4 font-bold text-white transition hover:bg-red-700 disabled:cursor-wait disabled:opacity-60">{deleting ? "Deleting..." : "Delete"}</button></div></div></ModalShell>;
}

export function SavedPlacesClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const action = searchParams.get("action");
  const ref = searchParams.get("ref");
  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [detail, setDetail] = useState<SavedPlace | null>(null);
  const [detailError, setDetailError] = useState<{ ref: string; message: string } | null>(null);
  const isDetailAction = action === "detail" || action === "delete";

  async function refreshPlaces() {
    setListError(null);
    const response = await fetch("/api/saved-places");
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.error ?? "We couldn't load your saved places.");
    }
    setPlaces(await response.json());
  }

  useEffect(() => {
    let active = true;
    // Initializing data from the external API is the effect's purpose here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshPlaces().catch((error) => { if (active) setListError(error instanceof Error ? error.message : "We couldn't load your saved places."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!isDetailAction || !ref) return;
    let active = true;
    fetch(`/api/saved-places/${encodeURIComponent(ref)}`).then(async (response) => { const body = await response.json().catch(() => null); if (!response.ok) throw new Error(body?.error ?? "This saved place is not available to your account."); return body as SavedPlace; }).then((place) => { if (active) setDetail(place); }).catch((error) => { if (active) setDetailError({ ref, message: error instanceof Error ? error.message : "This saved place is not available to your account." }); });
    return () => { active = false; };
  }, [isDetailAction, ref]);

  const openBase = () => router.replace("/dashboard?view=saved-places", { scroll: false });
  const openCreate = () => router.replace("/dashboard?view=saved-places&action=create", { scroll: false });
  const openDetail = (publicId: string) => router.replace(`/dashboard?view=saved-places&action=detail&ref=${encodeURIComponent(publicId)}`, { scroll: false });
  const openDelete = () => { if (ref) router.replace(`/dashboard?view=saved-places&action=delete&ref=${encodeURIComponent(ref)}`, { scroll: false }); };
  async function handleSaved() { await refreshPlaces(); }
  async function handleDeleted() { await refreshPlaces(); openBase(); }
  const visibleDetail = detail?.publicId === ref ? detail : null;
  const visibleDetailError = detailError?.ref === ref ? detailError.message : null;

  return <>
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-3xl font-extrabold tracking-tight text-slate-950">Saved places</h1><p className="mt-2 text-base text-slate-500">Places you&apos;ve saved for your next trip.</p></div>{!loading && places.length > 0 && <button type="button" onClick={openCreate} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700"><PlusIcon />Save a place</button>}</div>
    {listError && <div className="mt-8"><ErrorMessage message={listError} /></div>}
    {loading ? <div className="mt-8 flex min-h-[32rem] items-center justify-center rounded-3xl border border-slate-100"><span className="wave-spinner"><i /><i /><i /></span><span className="ml-3 text-sm text-slate-500">Loading your saved places...</span></div> : places.length === 0 ? <div className="mt-8 flex min-h-[32rem] flex-col items-center justify-center rounded-3xl border border-slate-100 px-6 py-12 text-center"><div className="relative h-52 w-72"><Image src="/images/illustrations/saved-places-empty-state.png" alt="Map with a location pin" fill className="object-contain" /></div><h2 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-950">No saved places yet</h2><p className="mt-2 max-w-lg text-base text-slate-500">Save a destination you&apos;re thinking about, and find it here later.</p><button type="button" onClick={openCreate} className="mt-7 rounded-xl bg-blue-600 px-16 py-3.5 text-base font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700">Save a place</button></div> : <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{places.map((place, index) => <button key={place.publicId} type="button" onClick={() => openDetail(place.publicId)} className="group overflow-hidden rounded-2xl border border-slate-100 bg-white text-left shadow-sm transition hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-900/10"><div className={`flex h-36 items-center justify-center bg-gradient-to-br ${cardGradients[index % cardGradients.length]}`}>{place.unsplashImageUrl ? <PhotoPanel place={place} /> : <PinIcon />}</div><div className="p-5"><StatusBadge status={place.status} /><h2 className="mt-4 truncate text-lg font-extrabold text-slate-950">{place.destination}</h2><p className="mt-1.5 min-h-12 line-clamp-2 text-sm leading-6 text-slate-500">{place.note || "No note added yet."}</p></div></button>)}</div>}
    {action === "create" && <CreateModal onClose={openBase} onSaved={handleSaved} />}
    {isDetailAction && <DetailModal place={visibleDetail} error={visibleDetailError} onClose={openBase} onDelete={openDelete} />}
    {action === "delete" && <DeleteModal place={visibleDetail} onClose={openBase} onDeleted={handleDeleted} />}
  </>;
}
