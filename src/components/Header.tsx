"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authFetch, clearToken, fetchMeInfo } from "@/lib/clientAuth";
import VerifiedBadge from "@/components/VerifiedBadge";
import { isSensei } from "@/lib/verified";
import {
  Search,
  Upload,
  LogIn,
  LogOut,
  Menu,
  ChevronDown,
  User,
  UserPlus,
  Film,
  ShieldCheck,
} from "lucide-react";

export default function Header({
  user,
  verified = false,
}: {
  user: string | null;
  verified?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<string | null>(user);
  const [verifiedOverride, setVerifiedOverride] = useState<boolean | null>(null);
  const [adminOverride, setAdminOverride] = useState<boolean | null>(null);
  const currentVerified = verifiedOverride ?? verified;
  // Panel moderacji widzą sensei69 i mianowani admini.
  const currentAdmin = adminOverride ?? isSensei(currentUser);
  const [avatarV, setAvatarV] = useState(0);
  const [avatarOk, setAvatarOk] = useState(true);

  useEffect(() => {
    const bump = () => {
      setAvatarOk(true);
      setAvatarV((v) => v + 1);
    };
    window.addEventListener("polhub-avatar", bump);
    return () => window.removeEventListener("polhub-avatar", bump);
  }, []);

  // Gdy przeglądarka blokuje ciasteczka (podgląd w iframe),
  // sesję potwierdzamy tokenem z localStorage.
  useEffect(() => {
    let alive = true;
    fetchMeInfo().then((me) => {
      if (!alive || !me.user) return;
      setCurrentUser(me.user);
      setVerifiedOverride(me.verified);
      setAdminOverride(me.admin || me.sensei);
    });
    return () => {
      alive = false;
    };
  }, [user]);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/?q=${encodeURIComponent(q)}` : "/");
  }

  async function logout() {
    await authFetch("/api/logout", { method: "POST" });
    clearToken();
    setCurrentUser(null);
    setVerifiedOverride(false);
    setUserOpen(false);
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-50 bg-black shadow-[0_2px_12px_rgba(0,0,0,0.8)]">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:gap-5">
        {/* Logo */}
        <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="PolHub – strona główna">
          <span className="hidden sm:block">
            <Menu className="h-6 w-6 text-ph-muted transition-colors hover:text-white" />
          </span>
          <span className="font-display text-2xl font-black tracking-tight sm:text-3xl">
            <span className="text-white">Pol</span>
            <span className="ml-1 inline-block rounded-md bg-ph-orange px-2 py-0.5 text-black transition-transform hover:scale-105">
              Hub
            </span>
          </span>
        </Link>

        {/* Search */}
        <form onSubmit={onSearch} className="flex min-w-0 flex-1 justify-center">
          <div className="flex w-full max-w-xl items-stretch overflow-hidden rounded-full border border-ph-border bg-ph-dark transition-colors focus-within:border-ph-orange">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Szukaj na PolHub…"
              className="min-w-0 flex-1 bg-transparent px-4 py-2 text-sm text-white placeholder-ph-muted outline-none"
              aria-label="Szukaj filmów"
            />
            <button
              type="submit"
              className="flex items-center gap-1 bg-ph-panel px-4 text-ph-muted transition-colors hover:bg-ph-orange hover:text-black"
              aria-label="Szukaj"
            >
              <Search className="h-4 w-4" />
            </button>
          </div>
        </form>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <Link
            href="/upload"
            className="flex items-center gap-2 rounded-full bg-ph-orange px-3 py-2 text-sm font-bold text-black transition-all hover:bg-ph-orange-hover hover:shadow-[0_0_16px_rgba(255,144,0,0.4)] sm:px-4"
          >
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">Prześlij</span>
          </Link>

          {currentUser ? (
            <div className="relative">
              <button
                onClick={() => setUserOpen((v) => !v)}
                className="flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-ph-panel"
                aria-label="Menu konta"
              >
                <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-ph-orange font-display text-sm font-black text-black">
                  {avatarOk ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/avatar/${encodeURIComponent(currentUser)}?v=${avatarV}`}
                      alt=""
                      onError={() => setAvatarOk(false)}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    currentUser.charAt(0)
                  )}
                </span>
                <span className="hidden items-center gap-1 text-sm font-semibold md:flex">
                  {currentUser}
                  {currentVerified && <VerifiedBadge className="h-3.5 w-3.5" />}
                </span>
                <ChevronDown className="h-4 w-4 text-ph-muted" />
              </button>
              {userOpen && (
                <div className="animate-fade-up absolute right-0 top-full mt-2 w-48 overflow-hidden rounded-lg border border-ph-border bg-ph-panel shadow-2xl">
                  <div className="border-b border-ph-border px-4 py-3">
                    <p className="text-xs text-ph-muted">Zalogowano jako</p>
                    <p className="flex items-center gap-1 font-display font-bold text-ph-orange">
                      {currentUser}
                      {currentVerified && <VerifiedBadge className="h-4 w-4" />}
                    </p>
                  </div>
                  <Link
                    href="/account"
                    onClick={() => setUserOpen(false)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm transition-colors hover:bg-ph-dark"
                  >
                    <User className="h-4 w-4 text-ph-muted" /> Moje konto
                  </Link>
                  <Link
                    href="/upload"
                    onClick={() => setUserOpen(false)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm transition-colors hover:bg-ph-dark"
                  >
                    <Film className="h-4 w-4 text-ph-muted" /> Moje przesyłanie
                  </Link>
                  {currentAdmin && (
                    <Link
                      href="/admin"
                      onClick={() => setUserOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-ph-orange transition-colors hover:bg-ph-dark"
                    >
                      <ShieldCheck className="h-4 w-4" /> Panel moderacji
                    </Link>
                  )}
                  <button
                    onClick={logout}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-sm transition-colors hover:bg-ph-dark"
                  >
                    <LogOut className="h-4 w-4 text-ph-muted" /> Wyloguj się
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link
                href="/login"
                className="flex items-center gap-2 rounded-full border border-ph-border px-3 py-2 text-sm font-semibold text-white transition-colors hover:border-ph-orange hover:text-ph-orange sm:px-4"
              >
                <LogIn className="h-4 w-4" />
                <span className="hidden sm:inline">Zaloguj się</span>
              </Link>
              <Link
                href="/register"
                className="hidden items-center gap-2 rounded-full border border-ph-orange/60 px-4 py-2 text-sm font-semibold text-ph-orange transition-colors hover:bg-ph-orange hover:text-black md:flex"
              >
                <UserPlus className="h-4 w-4" />
                Rejestracja
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Mobile menu strip */}
      {menuOpen && (
        <div className="border-t border-ph-border bg-ph-dark px-4 py-3 text-sm sm:hidden">
          <Link href="/upload" className="flex items-center gap-2 py-1.5">
            <User className="h-4 w-4 text-ph-orange" /> Prześlij film
          </Link>
        </div>
      )}
    </header>
  );
}