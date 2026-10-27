"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, BellRing, Loader2, Users } from "lucide-react";
import { authFetch, fetchMeInfo } from "@/lib/clientAuth";

type Props = {
  channel: string;
  initialSubscribed: boolean;
  initialSubscribers: number;
  /** Zalogowany widz (null = anonim). */
  viewer: string | null;
  /** Wariant wyglądu. */
  size?: "md" | "lg";
  className?: string;
};

/**
 * Przycisk „Subskrybuj”. Zapisuje subskrypcję w bazie (jedna na konto),
 * pokazuje liczbę subskrybentów i pozwala ją cofnąć.
 */
export default function SubscribeButton({
  channel,
  initialSubscribed,
  initialSubscribers,
  viewer,
  size = "md",
  className = "",
}: Props) {
  const [subscribed, setSubscribed] = useState(initialSubscribed);
  const [count, setCount] = useState(initialSubscribers);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMine = !!viewer && viewer.toLowerCase() === channel.toLowerCase();

  async function toggle() {
    setError(null);

    // Anonim: nie znamy go po stronie serwera przy pierwszym renderze,
    // więc pytamy dopiero przy kliknięciu i odsyłamy do logowania.
    let me = viewer;
    if (!me) {
      const info = await fetchMeInfo();
      me = info.user;
      if (!me) {
        setError("Zaloguj się, aby subskrybować.");
        return;
      }
    }
    if (me.toLowerCase() === channel.toLowerCase()) {
      setError("Nie możesz subskrybować własnego kanału.");
      return;
    }

    setBusy(true);
    const before = { subscribed, count };
    // optymistycznie – klik ma działać natychmiast
    setSubscribed(!subscribed);
    setCount(Math.max(0, count + (subscribed ? -1 : 1)));

    try {
      const res = await authFetch(
        `/api/channels/${encodeURIComponent(channel)}/subscribe`,
        { method: "POST" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubscribed(before.subscribed);
        setCount(before.count);
        setError(data.error ?? "Nie udało się zapisać subskrypcji.");
        return;
      }
      if (typeof data.subscribers === "number") setCount(data.subscribers);
      if (typeof data.subscribed === "boolean") setSubscribed(data.subscribed);
      window.dispatchEvent(new Event("polhub-subscriptions"));
    } catch {
      setSubscribed(before.subscribed);
      setCount(before.count);
      setError("Błąd połączenia. Spróbuj ponownie.");
    } finally {
      setBusy(false);
    }
  }

  const pad = size === "lg" ? "px-6 py-2.5 text-sm" : "px-5 py-2 text-sm";
  const icon = size === "lg" ? "h-4 w-4" : "h-4 w-4";

  if (isMine) {
    return (
      <span
        className={`flex items-center gap-2 rounded-full border border-ph-border px-4 py-2 text-xs font-semibold text-ph-muted ${className}`}
      >
        <Users className="h-4 w-4" />
        {count} {count === 1 ? "subskrybent" : "subskrybentów"}
      </span>
    );
  }

  return (
    <div className={`flex flex-col items-end gap-1 ${className}`}>
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-pressed={subscribed}
        title={subscribed ? "Odsubskrybuj kanał" : "Subskrybuj kanał"}
        className={`flex items-center justify-center gap-2 rounded-full font-bold transition-all disabled:opacity-70 ${pad} ${
          subscribed
            ? "border border-ph-border bg-ph-panel text-white hover:border-red-400 hover:text-red-300"
            : "bg-ph-orange text-black hover:bg-ph-orange-hover"
        }`}
      >
        {busy ? (
          <Loader2 className={`${icon} animate-spin`} />
        ) : subscribed ? (
          <BellRing className={icon} />
        ) : (
          <Bell className={icon} />
        )}
        {subscribed ? "Subskrybowane" : "Subskrybuj"}
        <span
          className={`rounded-full px-1.5 py-0.5 text-[11px] font-black ${
            subscribed ? "bg-black/40 text-ph-muted" : "bg-black/15 text-black/80"
          }`}
        >
          {count}
        </span>
      </button>

      {error && (
        <span className="text-[11px] text-red-400">
          {error}
          {error.startsWith("Zaloguj się") && (
            <>
              {" "}
              <Link href="/login" className="font-semibold underline">
                Zaloguj
              </Link>
            </>
          )}
        </span>
      )}
    </div>
  );
}
