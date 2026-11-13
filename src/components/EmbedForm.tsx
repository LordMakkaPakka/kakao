"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Loader2, Link2, LogIn } from "lucide-react";
import { CATEGORIES } from "@/lib/format";
import { authFetch } from "@/lib/clientAuth";

const UPLOAD_CATEGORIES = CATEGORIES.filter(
  (c) => c !== "Wszystkie" && c !== "Popularne"
);

/**
 * Dodawanie filmu — tylko przez embed.
 *
 * Wgrywanie plików zostało wyłączone: film zawsze zostaje na serwisie
 * źródłowym, a PolHub pokazuje go w swojej ramce (z intro i znakiem PolHub).
 */
export default function EmbedForm() {
  const router = useRouter();
  const [embedUrl, setEmbedUrl] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("Amatorskie");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authError, setAuthError] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setAuthError(false);
    if (busy) return;
    if (!title.trim()) return setError("Podaj tytuł filmu.");
    if (!embedUrl.trim()) return setError("Wklej adres filmu albo kod iframe.");

    setBusy(true);
    try {
      const res = await authFetch("/api/videos/embed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          embedUrl,
          title: title.trim(),
          description: description.trim(),
          category,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401) setAuthError(true);
        throw new Error(data.error ?? "Nie udało się dodać filmu.");
      }
      setSuccess(data.provider ?? "serwis zewnętrzny");
      setTimeout(() => {
        router.push(`/watch/${data.id}`);
        router.refresh();
      }, 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się dodać filmu.");
    } finally {
      setBusy(false);
    }
  }

  if (success) {
    return (
      <div className="animate-fade-up rounded-2xl border border-green-500/40 bg-green-500/10 p-12 text-center">
        <CheckCircle2 className="mx-auto h-14 w-14 text-green-400" />
        <h2 className="mt-4 font-display text-2xl font-black text-white">Film dodany!</h2>
        <p className="mt-2 text-sm text-ph-muted">
          Intro PolHub zagra przed filmem z {success} 🥁 Zaraz obejrzysz swój film…
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="animate-fade-up space-y-6">
      <div className="space-y-3 rounded-2xl border border-ph-border bg-ph-dark p-6">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ph-muted">
            Adres filmu albo kod &lt;iframe&gt; *
          </span>
          <textarea
            value={embedUrl}
            onChange={(e) => setEmbedUrl(e.target.value)}
            rows={3}
            placeholder={'https://www.youtube.com/watch?v=…  •  https://streamable.com/e/…  •  <iframe src="…"></iframe>'}
            className="w-full resize-none rounded-lg border border-ph-border bg-ph-black px-3 py-3 text-sm text-white placeholder-ph-muted outline-none transition-colors focus:border-ph-orange"
          />
        </label>
        <p className="rounded-lg border border-ph-border bg-ph-black px-3 py-2 text-xs leading-relaxed text-ph-muted">
          Obsługujemy YouTube, Vimeo, Dailymotion, Streamable i inne serwisy
          pozwalające na osadzanie. Film zostaje u źródła — nie zajmuje miejsca
          na PolHubie. <strong className="text-white">Intro PolHub nadal leci</strong>{" "}
          (przed filmem), a odtwarzacz dostaje ramkę PolHub ze znakiem serwisu.
        </p>
      </div>

      <div className="grid gap-5 rounded-2xl border border-ph-border bg-ph-dark p-6 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ph-muted">
            Tytuł *
          </span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={150}
            placeholder="Np. Mój kot robi salto (HD)"
            className="w-full rounded-lg border border-ph-border bg-ph-black px-3 py-3 text-sm text-white placeholder-ph-muted outline-none transition-colors focus:border-ph-orange"
            required
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ph-muted">
            Kategoria
          </span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-lg border border-ph-border bg-ph-black px-3 py-3 text-sm text-white outline-none transition-colors focus:border-ph-orange"
          >
            {UPLOAD_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ph-muted">
            Opis
          </span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
            rows={4}
            placeholder="Opowiedz światu, co widać na filmie…"
            className="w-full resize-none rounded-lg border border-ph-border bg-ph-black px-3 py-3 text-sm text-white placeholder-ph-muted outline-none transition-colors focus:border-ph-orange"
          />
        </label>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {error}{" "}
            {authError && (
              <Link href="/login" className="font-bold underline hover:text-red-300">
                Przejdź do logowania →
              </Link>
            )}
          </span>
        </div>
      )}

      <button
        type="submit"
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-ph-orange py-3.5 font-display text-sm font-black uppercase tracking-wide text-black transition-all hover:bg-ph-orange-hover hover:shadow-[0_0_24px_rgba(255,144,0,0.4)] disabled:opacity-60"
      >
        {busy ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" /> Dodawanie…
          </>
        ) : (
          <>
            <Link2 className="h-5 w-5" /> Dodaj film
          </>
        )}
      </button>
    </form>
  );
}

/** Ekran dla niezalogowanych — bez konta nie ma czego dodawać. */
export function EmbedLoginWall() {
  return (
    <div className="animate-fade-up rounded-2xl border border-ph-border bg-ph-dark p-10 text-center">
      <LogIn className="mx-auto h-10 w-10 text-ph-orange" />
      <h2 className="mt-4 font-display text-xl font-black text-white">
        Zaloguj się, żeby dodać film
      </h2>
      <p className="mt-2 text-sm text-ph-muted">
        Dodawanie filmów jest dostępne po zalogowaniu i odblokowaniu dostępu
        kodem z Telegrama.
      </p>
      <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Link
          href="/login"
          className="rounded-full bg-ph-orange px-6 py-2.5 font-display text-sm font-black uppercase tracking-wide text-black transition-colors hover:bg-ph-orange-hover"
        >
          Zaloguj się
        </Link>
        <Link
          href="/register"
          className="rounded-full border border-ph-border px-6 py-2.5 text-sm font-bold text-white transition-colors hover:border-ph-orange hover:text-ph-orange"
        >
          Zarejestruj się
        </Link>
      </div>
    </div>
  );
}
