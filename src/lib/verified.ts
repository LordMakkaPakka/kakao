/** Konta z odznaką weryfikacji. */
export const VERIFIED_USERS = ["Gnam", "AlanDom"];

export function isVerified(username: string | null | undefined): boolean {
  return !!username && VERIFIED_USERS.includes(username);
}
