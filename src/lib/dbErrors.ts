/**
 * Rozpoznawanie typowych awarii bazy danych.
 *
 * Najczęstszy przypadek w praktyce: limit hostingu Postgresa (np. Neon)
 * – kod 53000 „insufficient_resources” i komunikat o przekroczonym limicie.
 * Wtedy aplikacja nie może nawet utworzyć tabel, więc zamiast stosu błędów
 * pokazujemy jasny komunikat.
 */

type DbLikeError = {
  code?: string;
  message?: string;
  detail?: string;
  cause?: unknown;
};

function text(err: unknown): string {
  if (!err) return "";
  if (typeof err === "string") return err;
  const e = err as DbLikeError;
  const parts = [e.message, e.detail];
  if (e.cause) parts.push(text(e.cause));
  return parts.filter(Boolean).join(" ");
}

function code(err: unknown): string | undefined {
  const e = err as DbLikeError;
  if (e?.code) return e.code;
  if (e?.cause) return code(e.cause);
  return undefined;
}

/** Czy baza odrzuciła operację z powodu przekroczonego limitu (quota). */
export function isQuotaError(err: unknown): boolean {
  const msg = text(err).toLowerCase();
  return (
    code(err) === "53000" ||
    msg.includes("exceeded the quota") ||
    msg.includes("insufficient_resources") ||
    msg.includes("przekroczony limit") ||
    msg.includes("quota")
  );
}

/** Czy problem dotyczy połączenia z bazą (a nie logiki aplikacji). */
export function isDatabaseError(err: unknown): boolean {
  if (isQuotaError(err)) return true;
  const msg = text(err).toLowerCase();
  return (
    msg.includes("econnrefused") ||
    msg.includes("connection terminated") ||
    msg.includes("connection refused") ||
    msg.includes("timeout expired") ||
    msg.includes("terminating connection") ||
    msg.includes("database") ||
    msg.includes("relation") ||
    msg.includes("password authentication failed")
  );
}

export type DbFailureKind = "quota" | "connection" | "unknown";

export function classifyDbFailure(err: unknown): DbFailureKind {
  if (isQuotaError(err)) return "quota";
  if (isDatabaseError(err)) return "connection";
  return "unknown";
}

/** Komunikat dla użytkownika (po polsku, bez szczegółów technicznych). */
export function dbFailureMessage(kind: DbFailureKind): string {
  if (kind === "quota") {
    return "Baza danych osiągnęła swój limit (quota). Zwolnij miejsce lub podnieś plan w hostingu bazy, a strona ruszy bez zmian w kodzie.";
  }
  if (kind === "connection") {
    return "Nie mogę połączyć się z bazą danych. Sprawdź, czy baza działa i czy adres DATABASE_URL jest poprawny.";
  }
  return "Coś poszło nie tak po stronie serwera. Spróbuj odświeżyć stronę za chwilę.";
}
