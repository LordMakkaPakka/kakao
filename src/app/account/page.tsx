"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Ban,
  BellOff,
  Camera,
  Eye,
  Film,
  Loader2,
  PencilLine,
  Trash2,
} from "lucide-react";
import ConfirmDeleteButton from "@/components/ConfirmDeleteButton";
import { authFetch } from "@/lib/clientAuth";
import VerifiedBadge from "@/components/VerifiedBadge";
import { formatViews, timeAgo } from "@/lib/format";
import { formatCountdown } from "@/lib/banTime";

type MySubscription = {
  channel: string;
  subscribers: number;
  since: string;
};

type MyVideo = {
  id: number;
  title: string;
  thumbnail: string | null;
  views: number;
  createdAt: string;
};

/** Zmniejsza obrazek do kwadratu 256x256 (JPEG). */
function resizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const size = 256;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("canvas"));
      const s = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => reject(new Error("img"));
    img.src = url;
  });
}

export default function AccountPage() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<string | null>(null);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [bio, setBio] = useState("");
  const [savedBio, setSavedBio] = useState("");
  const [bioBusy, setBioBusy] = useState(false);
  const [bioInfo, setBioInfo] = useState<string | null>(null);
  const [ban, setBan] = useState<{ reason: string | null; remainingMs: number } | null>(null);
  const [list, setList] = useState<MyVideo[]>([]);
  const [subs, setSubs] = useState<MySubscription[]>([]);
  const [subBusy, setSubBusy] = useState<string | null>(null);
  const [subInfo, setSubInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    authFetch("/api/me", { cache: "no-store" })
      .then(async (r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d || typeof d.bio !== "string") return;
        setBio(d.bio);
        setSavedBio(d.bio);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    authFetch("/api/subscriptions", { cache: "no-store" })
      .then(async (r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && Array.isArray(d.channels)) setSubs(d.channels);
      })
      .catch(() => {});
  }, []);

  async function unsubscribe(channel: string) {
    setSubBusy(channel);
    setError(null);
    setSubInfo(null);
    try {
      const r = await authFetch(
        `/api/channels/${encodeURIComponent(channel)}/subscribe`,
        { method: "POST" }
      );
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(d.error ?? "Nie udało się odsubskrybować kanału.");
        return;
      }
      if (d.subscribed === true) {
        // Serwer nadal widzi subskrypcję (np. podwójne kliknięcie) – tylko odśwież licznik.
        setSubs((prev) =>
          prev.map((sub) =>
            sub.channel === channel
              ? { ...sub, subscribers: Number(d.subscribers) || sub.subscribers }
              : sub
          )
        );
        setSubInfo(`Kanał ${channel} jest nadal subskrybowany.`);
        return;
      }
      setSubs((prev) => prev.filter((sub) => sub.channel !== channel));
      setSubInfo(`Odsubskrybowano ${channel}.`);
    } catch {
      setError("Błąd połączenia.");
    } finally {
      setSubBusy(null);
    }
  }

  useEffect(() => {
    authFetch("/api/account/videos", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) return;
        const d = await r.json();
        setUser(d.user);
        setAvatar(d.avatar);
        setVerified(d.verified === true);
        if (d.banned) setBan({ reason: d.banReason ?? null, remainingMs: Number(d.remainingMs) || 0 });
        setList(d.videos);
      })
      .finally(() => setLoading(false));
  }, []);

  async function saveBio() {
    setBioBusy(true);
    setError(null);
    setBioInfo(null);
    try {
      const r = await authFetch("/api/account/bio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bio }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(d.error ?? "Nie udało się zapisać opisu.");
        return;
      }
      const saved = typeof d.bio === "string" ? d.bio : "";
      setBio(saved);
      setSavedBio(saved);
      setBioInfo("Opis profilu zapisany.");
    } catch {
      setError("Błąd połączenia.");
    } finally {
      setBioBusy(false);
    }
  }

  async function saveAvatar(value: string | null) {
    setBusy(true);
    setError(null);
    const r = await authFetch("/api/account/avatar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ avatar: value }),
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok) {
      setAvatar(value);
      window.dispatchEvent(new Event("polhub-avatar"));
    } else setError(d.error ?? "Nie udało się zapisać zdjęcia.");
    setBusy(false);
  }

  async function onPick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      await saveAvatar(await resizeImage(file));
    } catch {
      setError("Nie udało się odczytać obrazka.");
    }
  }

  async function remove(v: MyVideo) {
    setDeleting(v.id);
    const r = await authFetch(`/api/videos/${v.id}`, { method: "DELETE" });
    if (r.ok) setList((l) => l.filter((x) => x.id !== v.id));
    else setError("Nie udało się usunąć filmu.");
    setDeleting(null);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-ph-orange" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <p className="font-display text-xl font-bold text-white">Musisz się zalogować</p>
        <Link
          href="/login"
          className="mt-4 inline-block rounded-full bg-ph-orange px-5 py-2 text-sm font-bold text-black hover:bg-ph-orange-hover"
        >
          Zaloguj się
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {ban && (
        <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <Ban className="h-4 w-4 shrink-0" />
          <span>
            Konto jest zbanowane. Pozostało{" "}
            <strong>{formatCountdown(ban.remainingMs)}</strong>
            {ban.reason ? ` · powód: ${ban.reason}` : ""}. W tym czasie nie
            możesz komentować, oceniać ani wrzucać filmów.
          </span>
        </div>
      )}
      <div className="flex flex-col items-center gap-5 rounded-xl border border-ph-border bg-ph-dark p-6 sm:flex-row">
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="group relative h-24 w-24 shrink-0 overflow-hidden rounded-full bg-ph-orange"
          aria-label="Zmień zdjęcie profilowe"
        >
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt={user} className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center font-display text-4xl font-black text-black">
              {user.charAt(0)}
            </span>
          )}
          <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
            {busy ? <Loader2 className="h-6 w-6 animate-spin text-white" /> : <Camera className="h-6 w-6 text-white" />}
          </span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPick} />
        <div className="text-center sm:text-left">
          <h1 className="flex items-center justify-center gap-2 font-display text-2xl font-extrabold text-white sm:justify-start">
            {user}
            {verified && <VerifiedBadge className="h-6 w-6" />}
          </h1>
          <p className="text-sm text-ph-muted">
            {verified ? "Zweryfikowany twórca PolHub" : "Twórca PolHub"} · {list.length} filmów
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="rounded-full bg-ph-orange px-4 py-1.5 text-sm font-bold text-black hover:bg-ph-orange-hover"
            >
              Zmień zdjęcie
            </button>
            <Link
              href={`/u/${encodeURIComponent(user)}`}
              className="rounded-full border border-ph-border px-4 py-1.5 text-sm font-semibold text-white hover:border-ph-orange hover:text-ph-orange"
            >
              Mój profil
            </Link>
            {avatar && (
              <button
                onClick={() => saveAvatar(null)}
                disabled={busy}
                className="rounded-full border border-ph-border px-4 py-1.5 text-sm font-semibold text-white hover:border-ph-orange hover:text-ph-orange"
              >
                Usuń zdjęcie
              </button>
            )}
          </div>
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      {/* Opis profilu */}
      <div className="mt-6 rounded-xl border border-ph-border bg-ph-dark p-5">
        <h2 className="flex items-center gap-2 font-display text-lg font-extrabold text-white">
          Opis <span className="text-ph-orange">profilu</span>
        </h2>
        <p className="mt-1 text-xs text-ph-muted">
          Widoczny publicznie na Twoim profilu — powiedz, co wrzucasz i czego
          mogą się spodziewać widzowie.
        </p>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value.slice(0, 600))}
          rows={4}
          maxLength={600}
          placeholder="Np. Amatorskie filmy z mojego miasta. Nowości co tydzień."
          className="mt-3 w-full resize-y rounded-lg border border-ph-border bg-black px-3 py-2 text-sm text-white placeholder-ph-muted outline-none transition-colors focus:border-ph-orange"
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <span
            className={`text-xs ${
              bio.length > 500 ? "text-ph-orange" : "text-ph-muted"
            }`}
          >
            {bio.length}/600
          </span>
          <div className="flex items-center gap-2">
            {bioInfo && <span className="text-xs text-green-400">{bioInfo}</span>}
            <button
              type="button"
              onClick={saveBio}
              disabled={bioBusy || bio === savedBio}
              className="flex items-center gap-1.5 rounded-full bg-ph-orange px-4 py-1.5 text-sm font-bold text-black transition-colors hover:bg-ph-orange-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {bioBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <PencilLine className="h-4 w-4" />
              )}
              Zapisz opis
            </button>
          </div>
        </div>
      </div>

      {/* Subskrypcje */}
      <div className="mt-6 rounded-xl border border-ph-border bg-ph-dark p-5">
        <h2 className="flex flex-wrap items-center gap-2 font-display text-lg font-extrabold text-white">
          Moje <span className="text-ph-orange">subskrypcje</span>
          <span className="rounded-full bg-ph-panel px-2 py-0.5 text-xs font-bold text-ph-muted">
            {subs.length}
          </span>
        </h2>
        {subInfo && <p className="mt-1 text-xs text-green-400">{subInfo}</p>}
        {subs.length === 0 ? (
          <p className="mt-2 text-sm text-ph-muted">
            Nie subskrybujesz jeszcze żadnego kanału. Wejdź na profil twórcy i
            kliknij „Subskrybuj”.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {subs.map((s) => (
              <li
                key={s.channel}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-ph-border bg-black/30 px-3 py-2"
              >
                <Link
                  href={`/u/${encodeURIComponent(s.channel)}`}
                  className="flex min-w-0 flex-1 items-center gap-2 font-semibold text-white transition-colors hover:text-ph-orange"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-ph-orange font-display text-sm font-black text-black">
                    {s.channel.charAt(0).toUpperCase()}
                  </span>
                  <span className="truncate">{s.channel}</span>
                </Link>
                <span className="text-xs text-ph-muted">
                  {s.subscribers} {s.subscribers === 1 ? "subskrybent" : "subskrybentów"}
                </span>
                <Link
                  href={`/u/${encodeURIComponent(s.channel)}`}
                  className="rounded-full border border-ph-border px-3 py-1 text-xs font-semibold text-white transition-colors hover:border-ph-orange hover:text-ph-orange"
                >
                  Profil
                </Link>
                <button
                  type="button"
                  onClick={() => unsubscribe(s.channel)}
                  disabled={subBusy === s.channel}
                  className="flex items-center gap-1.5 rounded-full border border-ph-border px-3 py-1 text-xs font-semibold text-red-400 transition-colors hover:border-red-400 hover:bg-red-500/10 disabled:opacity-60"
                >
                  {subBusy === s.channel ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <BellOff className="h-3.5 w-3.5" />
                  )}
                  Odsubskrybuj
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <h2 className="mb-4 mt-8 font-display text-lg font-extrabold text-white">
        Moje <span className="text-ph-orange">filmy</span>
      </h2>

      {list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ph-border bg-ph-dark p-8 text-center">
          <Film className="mx-auto h-8 w-8 text-ph-border" />
          <p className="mt-2 text-sm text-ph-muted">Nie masz jeszcze żadnych filmów.</p>
          <Link
            href="/upload"
            className="mt-4 inline-block rounded-full bg-ph-orange px-5 py-2 text-sm font-bold text-black hover:bg-ph-orange-hover"
          >
            Prześlij film
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {list.map((v) => (
            <li key={v.id} className="flex items-center gap-3 rounded-lg border border-ph-border bg-ph-dark p-2">
              <Link href={`/watch/${v.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                <div className="aspect-video w-28 shrink-0 overflow-hidden rounded bg-ph-panel">
                  {v.thumbnail && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={v.thumbnail} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{v.title}</p>
                  <p className="flex items-center gap-2 text-xs text-ph-muted">
                    <Eye className="h-3.5 w-3.5" /> {formatViews(v.views)} · {timeAgo(new Date(v.createdAt))}
                  </p>
                </div>
              </Link>
              <ConfirmDeleteButton
                label="Usuń"
                question={`Usunąć film „${v.title}”?`}
                hint="Tego nie da się cofnąć."
                busy={deleting === v.id}
                triggerClassName="flex shrink-0 items-center gap-1.5 rounded-md border border-ph-border px-3 py-2 text-xs font-semibold text-red-400 transition-colors hover:border-red-400 hover:bg-red-500/10 disabled:opacity-60"
                onConfirm={() => remove(v)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
