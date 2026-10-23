/**
 * Odznaki weryfikacji.
 *
 * Konto `sensei69` (oraz mianowani przez niego admini) może nadawać i odbierać
 * weryfikację innym kontom (panel: /admin). Nadane odznaki trzymamy w tabeli
 * `verifications`, a odebrane – w `verification_revocations`.
 * Poniższa lista to stałe, domyślne odznaki nadane od początku istnienia serwisu.
 */
export const VERIFIED_USERS = ["Gnam", "AlanDom", "SweetieFox"];

/** Konto z pełnymi uprawnieniami (super admin) – nadaje też adminów. */
export const SENSEI_USERNAME = "sensei69";

export function isVerified(username: string | null | undefined): boolean {
  if (!username) return false;
  const name = username.trim().toLowerCase();
  return VERIFIED_USERS.some((u) => u.toLowerCase() === name);
}

/** Odznaka z listy stałej – nie można jej odebrać. */
export function isStaticVerified(username: string): boolean {
  return VERIFIED_USERS.some((u) => u.toLowerCase() === username.toLowerCase());
}

export function isSensei(username: string | null | undefined): boolean {
  return !!username && username.trim().toLowerCase() === SENSEI_USERNAME;
}
