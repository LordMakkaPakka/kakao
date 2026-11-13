"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  Loader2,
  LockKeyhole,
  Send,
} from "lucide-react";
import { authFetch } from "@/lib/clientAuth";
import type { TelegramStatus } from "@/lib/telegram";

/**
 * Ekran blokady: film odtworzy się dopiero po wpisaniu kodu od bota.
 *
 * Przebieg: 1) napisz do bota na Telegramie `/start`, 2) bot odpisze kodem,
 * 3) wklej kod tutaj. Kod jest jednorazowy i ważny 15 minut. sensei69 może
 * dostęp odebrać — wtedy wystarczy napisać do bota po nowy kod.
 */
export default function TelegramGate({
  status,
  compact = false,
}: {
  status: TelegramStatus;
  compact?: boolean;
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Bot odpowiada kodem dopiero, gdy serwer odbierze wiadomość. Robimy to
  // w tle, co kilka sekund, żeby kod przyszedł od razu — bez czekania na
  // harmonogram crona. Serwer sam ogranicza częstotliwość.
  useEffect(() => {
    if (!status.required || status.linked) return;
    let alive = true;
    const tick = () => {
      if (!alive || document.visibilityState === "hidden") return;
      authFetch("/api/telegram/poll", { method: "POST" }).catch(() => {});
    };
    tick();
    const id = setInterval(tick, 5000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [status.required, status.linked]);

  const bot = status.bot;
  const telegramLink = bot ? `https://t.me/${bot}` : "https://t.me";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await authFetch("/api/telegram/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Nie udało się sprawdzić kodu.");
        return;
      }
      setDone(true);
      // Odśwież stronę — bramka znika i pojawia się odtwarzacz.
      setTimeout(() => router.refresh(), 600);
    } catch {
      setError("Błąd połączenia. Spróbuj ponownie.");
    } finally {
      setBusy(false);
    }
  }

  if (!status.required) {
    return (
      <div className="rounded-xl border border-ph-border bg-ph-dark p-6 text-sm text-ph-muted">
        Dostęp przez Telegram nie jest włączony na tym serwisie.
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-ph-border bg-ph-dark ${
        compact ? "p-5" : "p-6 sm:p-8"
      }`}
    >
      <div className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full bg-ph-orange/15 blur-3xl" />

      <div className="relative">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ph-orange text-black">
            <LockKeyhole className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-display text-lg font-black text-white sm:text-xl">
              Odblokuj dostęp <span className="text-ph-orange">kodem z Telegrama</span>
            </h2>
            <p className="text-xs text-ph-muted">
              Jednorazowy kod · ważny 15 minut · dostęp może odebrać moderacja
            </p>
          </div>
        </div>

        {!status.bot && (
          <p className="mt-4 flex items-start gap-2 rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            Bot nie jest jeszcze skonfigurowany na tym serwisie (brak{" "}
            <code className="mx-1">TELEGRAM_BOT_TOKEN</code>), więc nie da się
            wygenerować kodu. Zgłoś to administratorowi.
          </p>
        )}

        <ol className="mt-5 space-y-3 text-sm text-ph-text">
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ph-panel text-xs font-black text-ph-orange">
              1
            </span>
            <span>
              Napisz do bota{" "}
              <a
                href={telegramLink}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 font-bold text-ph-orange underline decoration-ph-orange/40 hover:decoration-ph-orange"
              >
                <Send className="h-3.5 w-3.5" />
                {bot ? `@${bot}` : "na Telegramie"}
              </a>{" "}
              wiadomość <code className="rounded bg-ph-panel px-1">/start</code>.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ph-panel text-xs font-black text-ph-orange">
              2
            </span>
            <span>
              Bot odpisze 6-znakowym kodem (zwykle w kilka sekund — ta strona
              sprawdza wiadomości w tle).
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ph-panel text-xs font-black text-ph-orange">
              3
            </span>
            <span>Wklej kod poniżej — dostęp odblokuje się od razu.</span>
          </li>
        </ol>

        {!status.linked && done ? (
          <p className="mt-5 flex items-center gap-2 rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-2 text-sm text-green-300">
            <CheckCircle2 className="h-4 w-4" /> Dostęp odblokowany! Wczytuję film…
          </p>
        ) : !status.linked ? (
          <form onSubmit={submit} className="mt-5 flex flex-col gap-2 sm:flex-row">
            <div className="flex flex-1 items-center gap-2 rounded-lg border border-ph-border bg-ph-black px-3 focus-within:border-ph-orange">
              <KeyRound className="h-4 w-4 shrink-0 text-ph-muted" />
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={8}
                placeholder="NP. K7M2QX"
                autoComplete="one-time-code"
                className="w-full bg-transparent py-2.5 font-display text-base font-bold uppercase tracking-[0.2em] text-white placeholder-ph-muted outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={busy || code.trim().length < 6}
              className="flex items-center justify-center gap-2 rounded-lg bg-ph-orange px-5 py-2.5 font-display text-sm font-black uppercase tracking-wide text-black transition-colors hover:bg-ph-orange-hover disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              Odblokuj
            </button>
          </form>
        ) : (
          <p className="mt-5 rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-2 text-sm text-green-300">
            To konto ma już odblokowany dostęp
            {status.telegramUsername ? ` (Telegram: @${status.telegramUsername})` : ""}.
          </p>
        )}

        {error && (
          <p role="alert" className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        {!status.linked && (
          <p className="mt-4 text-xs text-ph-muted">
            Nie masz Telegrama?{" "}
            <Link href="/login" className="font-semibold text-white underline hover:text-ph-orange">
              Zaloguj się na inne konto
            </Link>{" "}
            — kod jest przypisany do konta PolHub, na którym go wpiszesz.
          </p>
        )}
      </div>
    </div>
  );
}
