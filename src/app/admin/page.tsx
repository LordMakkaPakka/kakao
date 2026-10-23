"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  Ban,
  Clock,
  Eye,
  Film,
  KeyRound,
  Loader2,
  Lock,
  MessageSquare,
  Search,
  ShieldCheck,
  Unlock,
  UserRoundX,
  Users,
} from "lucide-react";
import { authFetch, fetchMeInfo } from "@/lib/clientAuth";
import VerifiedBadge from "@/components/VerifiedBadge";
import ConfirmDeleteButton from "@/components/ConfirmDeleteButton";
import { timeAgo } from "@/lib/format";
import { formatCountdown, BAN_UNITS, type BanUnit } from "@/lib/banTime";

type Account = {
  username: string;
  verified: boolean;
  staticVerified: boolean;
  registered: boolean;
  createdAt: string;
  videos: number;
  comments: number;
  bannedUntil: string | null;
  banReason: string | null;
  remainingMs: number;
  passwordFingerprint: string;
  sensei: boolean;
  admin: boolean;
};

type AdminVideo = {
  id: number;
  title: string;
  uploader: string;
  category: string;
  views: number;
  likes: number;
  dislikes: number;
  createdAt: string;
};

type AdminComment = {
  id: number;
  videoId: number;
  videoTitle: string;
  username: string;
  body: string;
  parentId: number | null;
  createdAt: string;
};

type Tab = "konta" | "filmy" | "komentarze";

const QUICK_BANS: { label: string; value: number; unit: BanUnit }[] = [
  { label: "1 min", value: 1, unit: "minutes" },
  { label: "10 min", value: 10, unit: "minutes" },
  { label: "1 godz.", value: 1, unit: "hours" },
  { label: "1 dzień", value: 1, unit: "days" },
  { label: "7 dni", value: 7, unit: "days" },
  { label: "30 dni", value: 30, unit: "days" },
  { label: "1 rok", value: 1, unit: "years" },
];

function BanBox({ account, onDone }: { account: Account; onDone: () => void }) {
  const [value, setValue] = useState("1");
  const [unit, setUnit] = useState<BanUnit>("days");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(payload: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await authFetch("/api/admin/ban", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: account.username, ...payload }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Nie udało się zapisać.");
        return;
      }
      onDone();
    } catch {
      setError("Błąd połączenia.");
    } finally {
      setBusy(false);
    }
  }

  const active = account.remainingMs > 0;

  return (
    <div className="mt-3 rounded-lg border border-ph-border bg-black/40 p-3">
      {active && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          <Ban className="h-4 w-4" />
          Ban jeszcze przez <strong>{formatCountdown(account.remainingMs)}</strong>
          {account.banReason && <span>· powód: {account.banReason}</span>}
          <button
            type="button"
            onClick={() => send({ action: "unban" })}
            disabled={busy}
            className="ml-auto flex items-center gap-1.5 rounded-full border border-red-400/60 px-3 py-1 font-bold text-red-300 transition-colors hover:bg-red-500/20 disabled:opacity-60"
          >
            <Unlock className="h-3.5 w-3.5" /> Odbanuj
          </button>
        </div>
      )}

      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ph-muted">
        <Clock className="h-3.5 w-3.5" /> {active ? "Zmień / przedłuż bana" : "Zbanuj konto"}
      </p>

      <div className="flex flex-wrap gap-1.5">
        {QUICK_BANS.map((q) => (
          <button
            key={q.label}
            type="button"
            onClick={() => send({ action: "ban", value: q.value, unit: q.unit, reason })}
            disabled={busy}
            className="rounded-full bg-ph-panel px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-500 hover:text-black disabled:opacity-60"
          >
            {q.label}
          </button>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/[^0-9]/g, ""))}
          inputMode="numeric"
          aria-label="Ile jednostek bana"
          className="w-16 rounded-md border border-ph-border bg-black px-2 py-1.5 text-xs text-white outline-none focus:border-ph-orange"
        />
        <select
          value={unit}
          onChange={(e) => setUnit(e.target.value as BanUnit)}
          aria-label="Jednostka bana"
          className="rounded-md border border-ph-border bg-black px-2 py-1.5 text-xs text-white outline-none focus:border-ph-orange"
        >
          {BAN_UNITS.map((u) => (
            <option key={u.value} value={u.value}>
              {u.label}
            </option>
          ))}
        </select>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value.slice(0, 300))}
          placeholder="Powód (opcjonalnie)"
          className="min-w-0 flex-1 rounded-md border border-ph-border bg-black px-2 py-1.5 text-xs text-white placeholder-ph-muted outline-none focus:border-ph-orange"
        />
        <button
          type="button"
          onClick={() =>
            send({
              action: "ban",
              value: Number(value) || 1,
              unit,
              reason,
            })
          }
          disabled={busy}
          className="flex items-center gap-1.5 rounded-full bg-red-500 px-3 py-1.5 text-xs font-bold text-black transition-colors hover:bg-red-400 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
          Nałóż bana
        </button>
      </div>

      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}

export default function AdminPage() {
  const [state, setState] = useState<"loading" | "denied" | "ready">("loading");
  const [me, setMe] = useState<string | null>(null);
  const [iamSensei, setIamSensei] = useState(false);
  const [tab, setTab] = useState<Tab>("konta");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [videos, setVideos] = useState<AdminVideo[]>([]);
  const [comments, setComments] = useState<AdminComment[]>([]);
  const [activeBans, setActiveBans] = useState(0);
  const [adminCount, setAdminCount] = useState(0);
  const [query, setQuery] = useState("");
  const [openBan, setOpenBan] = useState<string | null>(null);
  const [openPassword, setOpenPassword] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [now, setNow] = useState(0);

  // odświeżanie liczników banów co sekundę
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const load = useCallback(async () => {
    const res = await authFetch("/api/admin/overview", { cache: "no-store" });
    if (!res.ok) {
      setState("denied");
      return;
    }
    const data = await res.json();
    setAccounts(Array.isArray(data.accounts) ? data.accounts : []);
    setVideos(Array.isArray(data.videos) ? data.videos : []);
    setComments(Array.isArray(data.comments) ? data.comments : []);
    setActiveBans(Number(data.activeBans) || 0);
    setAdminCount(Array.isArray(data.admins) ? data.admins.length : 0);
    setState("ready");
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const info = await fetchMeInfo();
      if (!alive) return;
      setMe(info.user);
      setIamSensei(!!info.sensei);
      if (!info.user || !info.admin) {
        setState("denied");
        return;
      }
      await load();
    })();
    return () => {
      alive = false;
    };
  }, [load]);

  const filteredAccounts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter((a) => a.username.toLowerCase().includes(q));
  }, [accounts, query]);

  const filteredVideos = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return videos;
    return videos.filter(
      (v) =>
        v.title.toLowerCase().includes(q) || v.uploader.toLowerCase().includes(q)
    );
  }, [videos, query]);

  const filteredComments = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return comments;
    return comments.filter(
      (c) =>
        c.username.toLowerCase().includes(q) ||
        c.body.toLowerCase().includes(q) ||
        c.videoTitle.toLowerCase().includes(q)
    );
  }, [comments, query]);

  async function deleteContent(type: "video" | "comment" | "account", id: string | number, label: string) {
    setBusy(`${type}-${id}`);
    setError(null);
    setInfo(null);
    try {
      const res = await authFetch(
        `/api/admin/content?type=${type}&id=${encodeURIComponent(String(id))}`,
        { method: "DELETE" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Nie udało się usunąć.");
        return;
      }
      setInfo(
        type === "account"
          ? `Usunięto konto ${label}.`
          : `Usunięto ${type === "video" ? "film" : "komentarz"}.`
      );
      await load();
    } catch {
      setError("Błąd połączenia.");
    } finally {
      setBusy(null);
    }
  }

  async function toggleVerified(account: Account) {
    setBusy(`verify-${account.username}`);
    setError(null);
    setInfo(null);
    try {
      const res = await authFetch("/api/admin/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: account.username,
          verified: !account.verified,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Nie udało się zmienić odznaki.");
        return;
      }
      setInfo(
        account.verified
          ? `Odebrano weryfikację kontu ${account.username}.`
          : `Nadano weryfikację kontu ${account.username}.`
      );
      await load();
    } catch {
      setError("Błąd połączenia.");
    } finally {
      setBusy(null);
    }
  }

  async function toggleAdmin(account: Account) {
    setBusy(`admin-${account.username}`);
    setError(null);
    setInfo(null);
    try {
      const res = await authFetch("/api/admin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: account.username,
          admin: !account.admin,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Nie udało się zmienić uprawnień.");
        return;
      }
      setInfo(
        account.admin
          ? `Odebrano uprawnienia admina kontu ${account.username}.`
          : `Nadano uprawnienia admina kontu ${account.username}.`
      );
      await load();
    } catch {
      setError("Błąd połączenia.");
    } finally {
      setBusy(null);
    }
  }

  async function savePassword(account: Account) {
    if (newPassword.length < 4) {
      setError("Hasło musi mieć co najmniej 4 znaki.");
      return;
    }
    setBusy(`pass-${account.username}`);
    setError(null);
    try {
      const res = await authFetch("/api/admin/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: account.username, password: newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Nie udało się zmienić hasła.");
        return;
      }
      setInfo(`Zmieniono hasło kontu ${account.username}.`);
      setOpenPassword(null);
      setNewPassword("");
      await load();
    } catch {
      setError("Błąd połączenia.");
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
          Panel tylko dla <span className="text-ph-orange">moderacji</span>
        </h1>
        <p className="mt-2 text-sm text-ph-muted">
          {me
            ? `Zalogowano jako ${me}. To konto nie ma uprawnień moderacji — admina nadaje sensei69.`
            : "Zaloguj się na konto sensei69 albo na konto z uprawnieniami admina."}
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

  const tabs: { id: Tab; label: string; count: number; icon: typeof Users }[] = [
    { id: "konta", label: "Konta", count: accounts.length, icon: Users },
    { id: "filmy", label: "Filmy", count: videos.length, icon: Film },
    { id: "komentarze", label: "Komentarze", count: comments.length, icon: MessageSquare },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="rounded-2xl border border-ph-border bg-ph-dark p-5 sm:p-7">
        <div className="flex flex-wrap items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ph-orange text-black">
            <ShieldCheck className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-black text-white">
              Panel <span className="text-ph-orange">moderacji</span>
            </h1>
            <p className="mt-1 text-sm text-ph-muted">
              Bany (sekundy → lata), usuwanie filmów, komentarzy i kont,
              odbieranie i nadawanie weryfikacji (także SweetieFox i innym
              adminom) oraz reset haseł. Aktywne bany:{" "}
              <strong className="text-white">{activeBans}</strong> · Admini:{" "}
              <strong className="text-white">{adminCount}</strong>
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2 border-b border-ph-border pb-3">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-colors ${
                  tab === t.id
                    ? "bg-ph-orange text-black"
                    : "bg-ph-panel text-ph-muted hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4" /> {t.label}
                <span className={tab === t.id ? "text-black/70" : "text-ph-border"}>
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-full border border-ph-border bg-black px-4 focus-within:border-ph-orange">
          <Search className="h-4 w-4 text-ph-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              tab === "konta"
                ? "Szukaj konta…"
                : tab === "filmy"
                  ? "Szukaj filmu lub autora…"
                  : "Szukaj w komentarzach…"
            }
            className="w-full bg-transparent py-2.5 text-sm text-white placeholder-ph-muted outline-none"
          />
        </div>

        {error && (
          <p role="alert" className="mt-3 text-sm text-red-400">
            {error}
          </p>
        )}
        {info && <p className="mt-3 text-sm text-green-400">{info}</p>}

        {/* KONTA */}
        {tab === "konta" && (
          <ul className="mt-4 divide-y divide-ph-border">
            {filteredAccounts.length === 0 && (
              <li className="py-8 text-center text-sm text-ph-muted">
                Brak kont pasujących do wyszukiwania.
              </li>
            )}
            {filteredAccounts.map((a) => {
              const remaining = a.bannedUntil
                ? Math.max(0, new Date(a.bannedUntil).getTime() - now)
                : 0;
              const banned = remaining > 0;
              return (
                <li key={a.username} className="py-4">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-1.5 font-display font-bold text-white">
                        {a.username}
                        {a.verified && <VerifiedBadge className="h-4 w-4" />}
                        {a.sensei && (
                          <span className="rounded bg-ph-orange px-1.5 py-0.5 text-[10px] font-black uppercase text-black">
                            super admin
                          </span>
                        )}
                        {!a.sensei && a.admin && (
                          <span className="rounded bg-white/15 px-1.5 py-0.5 text-[10px] font-black uppercase text-white">
                            admin
                          </span>
                        )}
                        {banned && (
                          <span className="flex items-center gap-1 rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-red-300">
                            <Ban className="h-3 w-3" /> {formatCountdown(remaining)}
                          </span>
                        )}
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ph-muted">
                        {a.registered ? (
                          <span>konto od {timeAgo(new Date(a.createdAt))}</span>
                        ) : (
                          <span className="text-ph-border">
                            konto z listy startowej — bez rejestracji
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Film className="h-3 w-3" /> {a.videos}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" /> {a.comments}
                        </span>
                        {a.registered && (
                          <span className="flex items-center gap-1 font-mono text-[11px] text-ph-border">
                            <KeyRound className="h-3 w-3" /> hasło: {a.passwordFingerprint}
                          </span>
                        )}
                        {a.staticVerified && (
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                              a.verified
                                ? "bg-[#1d9bf0]/20 text-[#69c0f5]"
                                : "bg-ph-panel text-ph-muted"
                            }`}
                          >
                            lista startowa
                          </span>
                        )}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {a.registered && (
                        <button
                          type="button"
                          onClick={() => setOpenPassword(openPassword === a.username ? null : a.username)}
                          className="flex items-center gap-1.5 rounded-full border border-ph-border px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:border-ph-orange hover:text-ph-orange"
                        >
                          <KeyRound className="h-3.5 w-3.5" /> Hasło
                        </button>
                      )}
                      {iamSensei && !a.sensei && a.registered && (
                        <button
                          type="button"
                          onClick={() => toggleAdmin(a)}
                          disabled={busy === `admin-${a.username}`}
                          className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60 ${
                            a.admin
                              ? "border-ph-orange bg-ph-orange/15 text-ph-orange hover:bg-ph-orange/25"
                              : "border-ph-border text-white hover:border-ph-orange hover:text-ph-orange"
                          }`}
                        >
                          {busy === `admin-${a.username}` ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <ShieldCheck className="h-3.5 w-3.5" />
                          )}
                          {a.admin ? "Odbierz admina" : "Nadaj admina"}
                        </button>
                      )}
                      {!a.sensei && (
                        <button
                          type="button"
                          onClick={() => toggleVerified(a)}
                          disabled={busy === `verify-${a.username}`}
                          className="flex items-center gap-1.5 rounded-full border border-ph-border px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:border-[#1d9bf0] hover:text-[#4db5f5] disabled:opacity-60"
                        >
                          <BadgeCheck className="h-3.5 w-3.5" />
                          {a.verified ? "Odbierz weryfikację" : "Nadaj weryfikację"}
                        </button>
                      )}
                      {!a.sensei && a.registered && (
                        <>
                          <button
                            type="button"
                            onClick={() => setOpenBan(openBan === a.username ? null : a.username)}
                            className="flex items-center gap-1.5 rounded-full border border-red-400/50 px-3 py-1.5 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/15 disabled:opacity-60"
                          >
                            <Ban className="h-3.5 w-3.5" />
                            {banned ? "Zarządzaj banem" : "Banuj"}
                          </button>
                          <ConfirmDeleteButton
                            label="Usuń konto"
                            question={`Usunąć konto ${a.username}?`}
                            hint="Znikną też jego filmy i komentarze. Tego nie da się cofnąć."
                            icon={<UserRoundX className="h-3.5 w-3.5" />}
                            busy={busy === `account-${a.username}`}
                            onConfirm={() =>
                              deleteContent("account", a.username, a.username)
                            }
                          />
                        </>
                      )}
                    </div>
                  </div>

                  {openPassword === a.username && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-ph-border bg-black/40 p-3">
                      <p className="w-full text-[11px] text-ph-muted">
                        Hasła są hashowane (scrypt) — nie da się ich odczytać.
                        Możesz ustawić nowe hasło dla tego konta.
                      </p>
                      <input
                        type="text"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Nowe hasło"
                        className="min-w-0 flex-1 rounded-md border border-ph-border bg-black px-2 py-1.5 text-xs text-white placeholder-ph-muted outline-none focus:border-ph-orange"
                      />
                      <button
                        type="button"
                        onClick={() => savePassword(a)}
                        disabled={busy === `pass-${a.username}`}
                        className="flex items-center gap-1.5 rounded-full bg-ph-orange px-3 py-1.5 text-xs font-bold text-black transition-colors hover:bg-ph-orange-hover disabled:opacity-60"
                      >
                        {busy === `pass-${a.username}` ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <KeyRound className="h-3.5 w-3.5" />
                        )}
                        Ustaw hasło
                      </button>
                    </div>
                  )}

                  {openBan === a.username && <BanBox account={a} onDone={load} />}
                </li>
              );
            })}
          </ul>
        )}

        {/* FILMY */}
        {tab === "filmy" && (
          <ul className="mt-4 divide-y divide-ph-border">
            {filteredVideos.length === 0 && (
              <li className="py-8 text-center text-sm text-ph-muted">
                Brak filmów.
              </li>
            )}
            {filteredVideos.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/watch/${v.id}`}
                    className="line-clamp-1 font-semibold text-white transition-colors hover:text-ph-orange"
                  >
                    {v.title}
                  </Link>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-ph-muted">
                    <span>{v.uploader}</span>
                    <span>{v.category}</span>
                    <span className="flex items-center gap-1">
                      <Eye className="h-3 w-3" /> {v.views}
                    </span>
                    <span>{timeAgo(new Date(v.createdAt))}</span>
                  </p>
                </div>
                <ConfirmDeleteButton
                  label="Usuń film"
                  question={`Usunąć film „${v.title}”?`}
                  hint="Tego nie da się cofnąć."
                  busy={busy === `video-${v.id}`}
                  onConfirm={() => deleteContent("video", v.id, v.title)}
                />
              </li>
            ))}
          </ul>
        )}

        {/* KOMENTARZE */}
        {tab === "komentarze" && (
          <ul className="mt-4 divide-y divide-ph-border">
            {filteredComments.length === 0 && (
              <li className="py-8 text-center text-sm text-ph-muted">
                Brak komentarzy.
              </li>
            )}
            {filteredComments.map((c) => (
              <li key={c.id} className="py-3">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-ph-muted">
                      <span className="font-semibold text-white">{c.username}</span>
                      {" · "}
                      <Link
                        href={`/watch/${c.videoId}`}
                        className="transition-colors hover:text-ph-orange"
                      >
                        {c.videoTitle}
                      </Link>
                      {" · "}
                      {timeAgo(new Date(c.createdAt))}
                      {c.parentId !== null && " · odpowiedź"}
                    </p>
                    <p className="mt-1 line-clamp-3 whitespace-pre-wrap break-words text-sm text-ph-text">
                      {c.body}
                    </p>
                  </div>
                  <ConfirmDeleteButton
                    label="Usuń"
                    question="Usunąć ten komentarz?"
                    hint={
                      c.parentId === null
                        ? "Znikną też odpowiedzi. Tego nie da się cofnąć."
                        : "Tego nie da się cofnąć."
                    }
                    busy={busy === `comment-${c.id}`}
                    onConfirm={() =>
                      deleteContent("comment", c.id, c.body.slice(0, 40))
                    }
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
