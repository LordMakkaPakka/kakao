import Link from "next/link";
import { Database, HardDrive } from "lucide-react";

/**
 * Ekran awarii bazy danych — pokazywany zamiast stosu błędów, gdy
 * baza odrzuca zapytania (np. przekroczony limit hostingu).
 */
export default function DbFailureScreen({
  kind,
  message,
}: {
  kind: "quota" | "connection" | "unknown";
  message: string;
}) {
  const title =
    kind === "quota"
      ? "Baza danych przekroczyła limit"
      : kind === "connection"
        ? "Brak połączenia z bazą"
        : "Chwilowy problem z serwerem";

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-2xl flex-col items-center justify-center px-4 py-16 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/15 text-red-400">
        {kind === "quota" ? (
          <HardDrive className="h-8 w-8" />
        ) : (
          <Database className="h-8 w-8" />
        )}
      </span>

      <h1 className="mt-5 font-display text-2xl font-black text-white sm:text-3xl">
        {title}
      </h1>

      <p className="mt-3 max-w-xl text-sm leading-relaxed text-ph-muted">
        {message}
      </p>

      {kind === "quota" && (
        <div className="mt-6 w-full rounded-xl border border-ph-border bg-ph-dark p-5 text-left">
          <p className="text-sm font-bold text-white">Co zrobić?</p>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-ph-muted">
            <li>Wejdź w panel hostingu bazy (np. Neon) i sprawdź zużycie miejsca.</li>
            <li>
              Usuń największe filmy — w tej wersji każdy film leży w bazie jako
              dane binarne, więc duże pliki szybko zjadają limit.
            </li>
            <li>Albo podnieś plan hostingu i odśwież stronę.</li>
          </ol>
          <p className="mt-3 text-xs text-ph-border">
            Film w bazie: tabela <code className="text-ph-muted">videos</code>,
            kolumna <code className="text-ph-muted">data</code> (limit 200 MB na
            plik).
          </p>
        </div>
      )}

      <Link
        href="/"
        className="mt-6 rounded-full bg-ph-orange px-5 py-2 text-sm font-bold text-black transition-colors hover:bg-ph-orange-hover"
      >
        Wróć na stronę główną
      </Link>
    </div>
  );
}
