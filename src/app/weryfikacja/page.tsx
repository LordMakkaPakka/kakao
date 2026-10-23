"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  Loader2,
  Lock,
  Search,
  ShieldCheck,
  UserRoundX,
} from "lucide-react";
import { authFetch, fetchMeInfo } from "@/lib/clientAuth";
import VerifiedBadge from "@/components/VerifiedBadge";
import { timeAgo } from "@/lib/format";

type AdminUser = {
  username: string;
  verified: boolean;
  staticVerified: boolean;
  createdAt: string;
  avatar: string | null;
};

function Avatar({ username, src }: { username: string; src: string | null }) {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-ph-orange font-display text-base font-black text-black">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        username.charAt(0).toUpperCase()
      )}
    </span>
  );
}

export default function WeryfikacjaPage() {
  const [state, setState] = useState<"loading" | "denied" | "ready">("loading");
  const [me, setMe] = useState<string | null>(null);
  const [list, setList] = useState<AdminUser[]>([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const info = await fetchMeInfo();
      if (!alive) return;
      setMe(info.user);
      if (!info.user || !info.sensei) {
        setState("denied");
        return;
      }
      const res = await authFetch("/api/admin/users", { cache: "no-store" });
      if (!alive) return;
      if (!res.ok) {
        setState("denied");
        return;
      }
      const data = await res.json();
      setList(Array.isArray(data.users) ? data.users : []);
      setState("ready");
    })();
    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((u) => u.username.toLowerCase().includes(q));
  }, [list, query]);

  async function toggle(user: AdminUser) {
    if (busy) return;
    setBusy(user.username);
    setError(null);
    setInfo(null);
    try {
      const res = await authFetch("/api/admin/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: user.username,
          verified: !user.verified,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Nie udało się zapisać zmiany.");
        return;
      }
      setList((prev) =>
        prev.map((u) =>
          u.username === user.username ? { ...u, verified: !user.verified } : u
        )
      );
      setInfo(
        !user.verified
          ? `Nadano weryfikację kontu ${user.username}.`
          : `Odebrano weryfikację kontu ${user.username}.`
      );
    } catch {
      setError("Błąd połączenia. Spróbuj ponownie.");
    } finally {
      setBusy(null);
    }
  }

  if (state === "loading") {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-ph-orange" />
      </div>
    );
  }

  if (state === "denied") {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <Lock className="mx-auto h-10 w-10 text-ph-border" />
        <h1 className="mt-4 font-display text-2xl font-black text-white">
          Tylko dla <span className="text-ph-orange">sensei69</span>
        </h1>
        <p className="mt-2 text-sm text-ph-muted">
          {me
            ? `Zalogowano jako ${me}. To konto nie może nadawać weryfikacji.`
            : "Musisz się zalogować na konto sensei69, aby nadawać weryfikację."}
        </p>
        <Link
          href={me ? "/" : "/login"}
          className="mt-6 inline-block rounded-full bg-ph-orange px-5 py-2 text-sm font-bold text-black transition-colors hover:bg-ph-orange-hover"
        >
          {me ? "Wróć na stronę główną" : "Zaloguj się"}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="rounded-2xl border border-ph-border bg-ph-dark p-6 sm:p-8">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ph-orange text-black">
            <ShieldCheck className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-black text-white">
              Nadawanie <span className="text-ph-orange">weryfikacji</span>
            </h1>
            <p className="mt-1 text-sm text-ph-muted">
              Panel dla konta sensei69. Nadana odznaka to niebieskie kółko z
              ptaszkiem — pojawia się przy nicku, filmach i komentarzach.
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-2 rounded-full border border-ph-border bg-ph-black px-4 transition-colors focus-within:border-ph-orange">
          <Search className="h-4 w-4 text-ph-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Szukaj konta…"
            className="w-full bg-transparent py-2.5 text-sm text-white placeholder-ph-muted outline-none"
          />
          <span className="shrink-0 text-xs text-ph-muted">{list.length}</span>
        </div>

        {error && (
          <p role="alert" className="mt-3 text-sm text-red-400">
            {error}
          </p>
        )}
        {info && <p className="mt-3 text-sm text-green-400">{info}</p>}

        <ul className="mt-5 divide-y divide-ph-border">
          {filtered.length === 0 && (
            <li className="py-8 text-center text-sm text-ph-muted">
              Brak kont pasujących do wyszukiwania.
            </li>
          )}
          {filtered.map((user) => (
            <li
              key={user.username}
              className="flex flex-wrap items-center gap-3 py-3"
            >
              <Avatar username={user.username} src={user.avatar} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 font-display font-bold text-white">
                  {user.username}
                  {user.verified && <VerifiedBadge className="h-4 w-4" />}
                </p>
                <p className="text-xs text-ph-muted">
                  Konto od {timeAgo(new Date(user.createdAt))}
                  {user.staticVerified && " · odznaka stała"}
                </p>
              </div>
              {user.staticVerified ? (
                <span className="rounded-full border border-ph-border px-3 py-1.5 text-xs font-semibold text-ph-muted">
                  Nadana na stałe
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => toggle(user)}
                  disabled={busy === user.username}
                  className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold transition-colors disabled:opacity-60 ${
                    user.verified
                      ? "border border-ph-border text-red-400 hover:border-red-400 hover:bg-red-500/10"
                      : "bg-ph-orange text-black hover:bg-ph-orange-hover"
                  }`}
                >
                  {busy === user.username ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : user.verified ? (
                    <UserRoundX className="h-3.5 w-3.5" />
                  ) : (
                    <BadgeCheck className="h-3.5 w-3.5" />
                  )}
                  {user.verified ? "Odbierz weryfikację" : "Nadaj weryfikację"}
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
