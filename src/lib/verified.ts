/**
 * Odznaki weryfikacji.
 *
 * Konto `sensei69` może nadawać i odbierać weryfikację innym kontom
 * (panel: /weryfikacja). Nadane odznaki trzymamy w tabeli `verifications`.
 * Poniższa lista to stałe, domyślne odznaki nadane od początku istnienia serwisu.
 */
export const VERIFIED_USERS = ["Gnam", "AlanDom", "SweetieFox"];

/** Konto z prawem nadawania weryfikacji. */
export const SENSEI_USERNAME = "sensei69";

export function isVerified(username: string | null | undefined): boolean {
  if (!username) return false;
  const name = username.trim().toLowerCase();
  return VERIFIED_USERS.some((u) => u.toLowerCase() === name);
}

export function isSensei(username: string | null | undefined): boolean {
  return !!username && username.trim().toLowerCase() === SENSEI_USERNAME;
}
