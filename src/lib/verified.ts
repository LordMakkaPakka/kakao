/**
 * Konta z odznaką weryfikacji (niebieskie kółko z ptaszkiem).
 * Wystarczy wpisać tu nazwę użytkownika – odznaka pojawi się
 * automatycznie po rejestracji, także przy komentarzach i filmach.
 * Wielkość liter nie ma znaczenia.
 */
export const VERIFIED_USERS = ["Gnam", "AlanDom", "SweetieFox"];

export function isVerified(username: string | null | undefined): boolean {
  if (!username) return false;
  const name = username.trim().toLowerCase();
  return VERIFIED_USERS.some((u) => u.toLowerCase() === name);
}
