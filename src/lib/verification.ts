import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { users, verifications } from "@/db/schema";
import { ensureSchema } from "@/lib/dbInit";
import { VERIFIED_USERS, isSensei } from "@/lib/verified";

export { isSensei };

/** Wszystkie nazwy kont z odznaką (stałe + nadane przez sensei69). */
export async function getVerifiedUsernames(): Promise<string[]> {
  await ensureSchema();
  const rows = await db
    .select({ username: verifications.username })
    .from(verifications);
  const all = new Map<string, string>();
  for (const name of VERIFIED_USERS) all.set(name.toLowerCase(), name);
  for (const row of rows) all.set(row.username.toLowerCase(), row.username);
  return [...all.values()];
}

/** Zbiór nazw (małymi literami) do szybkiego sprawdzania. */
export async function getVerifiedSet(): Promise<Set<string>> {
  const names = await getVerifiedUsernames();
  return new Set(names.map((n) => n.toLowerCase()));
}

export async function isVerifiedAccount(
  username: string | null | undefined
): Promise<boolean> {
  if (!username) return false;
  const set = await getVerifiedSet();
  return set.has(username.trim().toLowerCase());
}

/** Czy odznaka pochodzi z listy stałej (nie da się jej odebrać). */
export function isStaticVerified(username: string): boolean {
  return VERIFIED_USERS.some((u) => u.toLowerCase() === username.toLowerCase());
}

export type AdminUserRow = {
  username: string;
  verified: boolean;
  staticVerified: boolean;
  createdAt: string;
  avatar: string | null;
};

/** Lista kont dla panelu weryfikacji (tylko sensei69). */
export async function listUsersForAdmin(): Promise<AdminUserRow[]> {
  await ensureSchema();
  const rows = await db
    .select({
      username: users.username,
      avatar: users.avatar,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt))
    .limit(500);

  const set = await getVerifiedSet();
  return rows.map((row) => ({
    username: row.username,
    verified: set.has(row.username.toLowerCase()),
    staticVerified: isStaticVerified(row.username),
    createdAt: row.createdAt.toISOString(),
    avatar: row.avatar,
  }));
}

/** Nadanie odznaki. Zwraca false, gdy konto nie istnieje. */
export async function grantVerification(
  username: string,
  grantedBy: string
): Promise<boolean> {
  await ensureSchema();
  const [target] = await db
    .select({ username: users.username })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  if (!target) return false;
  await db
    .insert(verifications)
    .values({ username: target.username, grantedBy })
    .onConflictDoNothing();
  return true;
}

/** Odebranie odznaki (listy stałej nie ruszamy). */
export async function revokeVerification(username: string): Promise<void> {
  await ensureSchema();
  await db.delete(verifications).where(eq(verifications.username, username));
}
