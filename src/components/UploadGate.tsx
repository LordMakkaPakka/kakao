"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LockKeyhole, LogIn, ShieldCheck, UserPlus, Loader2 } from "lucide-react";
import { fetchMe } from "@/lib/clientAuth";
import UploadForm from "@/components/UploadForm";

export default function UploadGate({ initialUser }: { initialUser: string | null }) {
  const [user, setUser] = useState<string | null>(initialUser);
  const [checking, setChecking] = useState(initialUser === null);

  useEffect(() => {
    let alive = true;
    fetchMe().then((u) => {
      if (!alive) return;
      if (u) setUser(u);
      setChecking(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (checking) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-ph-muted">
        <Loader2 className="h-8 w-8 animate-spin text-ph-orange" />
        <p className="text-sm">Sprawdzanie sesji…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="relative flex min-h-[75vh] items-center justify-center px-4 py-16">
        <div className="pointer-events-none absolute left-1/2 top-16 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-ph-orange/10 blur-3xl" />
        <div className="animate-fade-up relative w-full max-w-lg rounded-2xl border border-ph-border bg-ph-dark p-10 text-center shadow-2xl">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-2 border-ph-orange bg-ph-panel">
            <LockKeyhole className="h-10 w-10 text-ph-orange" />
          </div>
          <h1 className="mt-6 font-display text-2xl font-black text-white sm:text-3xl">
            Strefa tylko dla zalogowanych
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-ph-muted">
            Aby wrzucić film na PolHub, musisz być zalogowany. Zaloguj się na
            swoje konto albo załóż nowe — to zajmie 10 sekund.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-full bg-ph-orange px-8 py-3 font-display text-sm font-black uppercase tracking-wide text-black transition-all hover:bg-ph-orange-hover hover:shadow-[0_0_24px_rgba(255,144,0,0.45)]"
            >
              <LogIn className="h-5 w-5" /> Zaloguj się
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-full border border-ph-border px-8 py-3 text-sm font-bold text-white transition-colors hover:border-ph-orange hover:text-ph-orange"
            >
              <UserPlus className="h-4 w-4" /> Zarejestruj się
            </Link>
          </div>
          <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-ph-muted">
            <ShieldCheck className="h-3.5 w-3.5 text-ph-orange" />
            Rejestracja jest darmowa i zawsze otwarta
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-8">
        <h1 className="font-display text-2xl font-black text-white sm:text-3xl">
          Prześlij <span className="text-ph-orange">film</span>
        </h1>
        <p className="mt-2 text-sm text-ph-muted">
          Witaj, <span className="font-bold text-ph-orange">{user}</span>! Śmiało —
          pliki wysyłane są w kawałkach (maks. 200 MB), a każdy film dostaje
          automatycznie intro PolHub z bębnem. 🥁
        </p>
      </div>
      <UploadForm />
    </div>
  );
}