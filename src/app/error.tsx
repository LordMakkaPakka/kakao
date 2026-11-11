"use client";

import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";

/**
 * Zapasowy ekran błędu dla podstron (segmentów). Łapie wyjątki, które nie
 * zostały obsłużone wyżej — np. gdy baza odrzuci zapytanie w trakcie
 * renderowania konkretnej strony.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 py-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500/15 text-red-400">
        <AlertTriangle className="h-7 w-7" />
      </span>
      <h1 className="mt-4 font-display text-2xl font-black text-white">
        Ta strona się nie wczytała
      </h1>
      <p className="mt-2 text-sm text-ph-muted">
        Najczęściej to chwilowy problem z bazą danych (np. przekroczony limit
        hostingu). Spróbuj jeszcze raz — reszta serwisu działa.
      </p>
      {error.digest && (
        <p className="mt-3 font-mono text-[11px] text-ph-border">
          kod błędu: {error.digest}
        </p>
      )}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={reset}
          className="flex items-center gap-2 rounded-full bg-ph-orange px-5 py-2 text-sm font-bold text-black transition-colors hover:bg-ph-orange-hover"
        >
          <RotateCcw className="h-4 w-4" /> Spróbuj ponownie
        </button>
        <Link
          href="/"
          className="rounded-full border border-ph-border px-5 py-2 text-sm font-semibold text-white transition-colors hover:border-ph-orange hover:text-ph-orange"
        >
          Strona główna
        </Link>
      </div>
    </div>
  );
}
