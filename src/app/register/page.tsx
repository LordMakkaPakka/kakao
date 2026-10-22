"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Lock,
  User,
  Eye,
  EyeOff,
  ShieldAlert,
  UserPlus,
  LogIn,
  CheckCircle2,
} from "lucide-react";
import { saveToken } from "@/lib/clientAuth";

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Hasła nie są takie same.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Rejestracja nie powiodła się.");
        return;
      }
      saveToken(data.token);
      // Konto utworzone i zalogowane – wracamy na stronę główną
      router.push("/");
      router.refresh();
    } catch {
      setError("Błąd połączenia. Spróbuj ponownie.");
    } finally {
      setLoading(false);
    }
  }

  const checks = [
    { ok: username.trim().length >= 3, label: "Nazwa: min. 3 znaki" },
    { ok: password.length >= 4, label: "Hasło: min. 4 znaki" },
    { ok: password.length > 0 && password === confirm, label: "Hasła się zgadzają" },
  ];

  return (
    <div className="relative flex min-h-[80vh] items-center justify-center px-4 py-12">
      <div className="pointer-events-none absolute left-1/2 top-10 h-72 w-[40rem] -translate-x-1/2 rounded-full bg-ph-orange/10 blur-3xl" />

      <div className="animate-fade-up relative w-full max-w-md">
        <div className="rounded-2xl border border-ph-border bg-ph-dark p-8 shadow-2xl sm:p-10">
          <div className="text-center">
            <p className="font-display text-3xl font-black">
              <span className="text-white">Pol</span>
              <span className="ml-1 rounded-md bg-ph-orange px-2 py-0.5 text-black">Hub</span>
            </p>
            <h1 className="mt-6 font-display text-xl font-extrabold text-white">
              Załóż darmowe konto
            </h1>
            <p className="mt-2 text-sm text-ph-muted">
              Rejestracja odblokowuje przesyłanie filmów. Po założeniu konta
              wrócisz na stronę główną, już zalogowany.
            </p>
          </div>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ph-muted">
                Nazwa użytkownika
              </span>
              <div className="flex items-center gap-2 rounded-lg border border-ph-border bg-ph-black px-3 transition-colors focus-within:border-ph-orange">
                <User className="h-4 w-4 shrink-0 text-ph-muted" />
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Np. JanuszFilmowiec"
                  autoComplete="username"
                  maxLength={24}
                  className="w-full bg-transparent py-3 text-sm text-white placeholder-ph-muted outline-none"
                  required
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ph-muted">
                Hasło
              </span>
              <div className="flex items-center gap-2 rounded-lg border border-ph-border bg-ph-black px-3 transition-colors focus-within:border-ph-orange">
                <Lock className="h-4 w-4 shrink-0 text-ph-muted" />
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className="w-full bg-transparent py-3 text-sm text-white placeholder-ph-muted outline-none"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="text-ph-muted transition-colors hover:text-white"
                  aria-label={showPass ? "Ukryj hasła" : "Pokaż hasła"}
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ph-muted">
                Powtórz hasło
              </span>
              <div className="flex items-center gap-2 rounded-lg border border-ph-border bg-ph-black px-3 transition-colors focus-within:border-ph-orange">
                <Lock className="h-4 w-4 shrink-0 text-ph-muted" />
                <input
                  type={showPass ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className="w-full bg-transparent py-3 text-sm text-white placeholder-ph-muted outline-none"
                  required
                />
              </div>
            </label>

            {/* Live checklist */}
            <ul className="flex flex-wrap gap-x-4 gap-y-1.5 rounded-lg bg-ph-black/50 px-3 py-2.5">
              {checks.map((c) => (
                <li
                  key={c.label}
                  className={`flex items-center gap-1.5 text-xs transition-colors ${
                    c.ok ? "text-green-400" : "text-ph-muted"
                  }`}
                >
                  <CheckCircle2 className={`h-3.5 w-3.5 ${c.ok ? "opacity-100" : "opacity-30"}`} />
                  {c.label}
                </li>
              ))}
            </ul>

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2.5 text-sm text-red-400">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-ph-orange py-3 font-display text-sm font-black uppercase tracking-wide text-black transition-all hover:bg-ph-orange-hover hover:shadow-[0_0_20px_rgba(255,144,0,0.4)] disabled:opacity-60"
            >
              <UserPlus className="h-4 w-4" />
              {loading ? "Tworzenie konta…" : "Zarejestruj się"}
            </button>
          </form>

          <div className="mt-6 rounded-lg border border-dashed border-ph-border bg-ph-black/50 px-4 py-4 text-center">
            <p className="text-xs text-ph-muted">Masz już konto?</p>
            <Link
              href="/login"
              className="mt-2 inline-flex items-center gap-2 rounded-full border border-ph-orange px-5 py-2 text-sm font-bold text-ph-orange transition-all hover:bg-ph-orange hover:text-black"
            >
              <LogIn className="h-4 w-4" /> Zaloguj się
            </Link>
          </div>

          <p className="mt-6 text-center text-xs text-ph-muted">
            <Link href="/" className="transition-colors hover:text-ph-orange hover:underline">
              ← Wróć na stronę główną
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}