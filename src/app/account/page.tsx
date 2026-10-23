"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BadgeCheck, Camera, Eye, Film, Loader2, Trash2 } from "lucide-react";
import { authFetch } from "@/lib/clientAuth";
import { isVerified } from "@/lib/verified";
import { formatViews, timeAgo } from "@/lib/format";

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
  const [list, setList] = useState<MyVideo[]>([]);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    authFetch("/api/account/videos", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) return;
        const d = await r.json();
        setUser(d.user);
        setAvatar(d.avatar);
        setList(d.videos);
      })
      .finally(() => setLoading(false));
  }, []);

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
    if (!confirm(`Usunąć film „${v.title}”? Tego nie da się cofnąć.`)) return;
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
            {isVerified(user) && <BadgeCheck className="h-6 w-6 text-ph-orange" aria-label="Zweryfikowany" />}
          </h1>
          <p className="text-sm text-ph-muted">
            {isVerified(user) ? "Zweryfikowany twórca PolHub" : "Twórca PolHub"} · {list.length} filmów
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="rounded-full bg-ph-orange px-4 py-1.5 text-sm font-bold text-black hover:bg-ph-orange-hover"
            >
              Zmień zdjęcie
            </button>
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
              <button
                onClick={() => remove(v)}
                disabled={deleting === v.id}
                aria-label={`Usuń ${v.title}`}
                className="flex shrink-0 items-center gap-1.5 rounded-md border border-ph-border px-3 py-2 text-xs font-semibold text-red-400 hover:border-red-400 hover:bg-red-500/10"
              >
                {deleting === v.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                <span className="hidden sm:inline">Usuń</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
