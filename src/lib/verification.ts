import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { users, verificationRevocations, verifications } from "@/db/schema";
import { ensureSchema } from "@/lib/dbInit";
import { VERIFIED_USERS, isSensei } from "@/lib/verified";

export { isSensei };

/** Nazwy (małymi literami), którym sensei69 odebrał odznakę. */
export async function getRevokedSet(): Promise<Set<string>> {
  await ensureSchema();
  const rows = await db
    .select({ username: verificationRevocations.username })
    .from(verificationRevocations);
  return new Set(rows.map((r) => r.username.trim().toLowerCase()));
}

/** Wszystkie nazwy kont z odznaką (stałe + nadane przez sensei69). */
export async function getVerifiedUsernames(): Promise<string[]> {
  await ensureSchema();
  const rows = await db
    .select({ username: verifications.username })
    .from(verifications);
  const revoked = await getRevokedSet();
  const all = new Map<string, string>();
  for (const name of VERIFIED_USERS)
    if (!revoked.has(name.toLowerCase())) all.set(name.toLowerCase(), name);
  for (const row of rows)
    if (!revoked.has(row.username.toLowerCase()))
      all.set(row.username.toLowerCase(), row.username);
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

/** Czy konto jest na liście startowej (sensei69 może tę odznakę odebrać). */
export function isStaticVerified(username: string): boolean {
  return VERIFIED_USERS.some((u) => u.toLowerCase() === username.toLowerCase());
}

export type AdminUserRow = {
  username: string;
  verified: boolean;
  staticVerified: boolean;
  /** Konto zapisane w bazie (false = tylko wpis z listy startowej). */
  registered: boolean;
  createdAt: string;
  avatar: string | null;
};

/** Lista kont dla panelu weryfikacji (sensei69 i admini). */
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
  const known = new Set(rows.map((row) => row.username.toLowerCase()));
  const list: AdminUserRow[] = rows.map((row) => ({
    username: row.username,
    verified: set.has(row.username.toLowerCase()),
    staticVerified: isStaticVerified(row.username),
    registered: true,
    createdAt: row.createdAt.toISOString(),
    avatar: row.avatar,
  }));
  for (const name of VERIFIED_USERS) {
    if (known.has(name.toLowerCase())) continue;
    list.push({
      username: name,
      verified: set.has(name.toLowerCase()),
      staticVerified: true,
      registered: false,
      createdAt: "",
      avatar: null,
    });
  }
  return list;
}

/**
 * Nadanie (albo przywrócenie) odznaki. Działa też dla nazw z listy startowej,
 * które nie mają konta w bazie. Zwraca false tylko dla nieznanej nazwy.
 */
export async function grantVerification(
  username: string,
  grantedBy: string
): Promise<boolean> {
  await ensureSchema();
  const [target] = await db
    .select({ username: users.username })
    .from(users)
    .where(sql`lower(${users.username}) = ${username.trim().toLowerCase()}`)
    .limit(1);
  const isListed = isStaticVerified(username);
  if (!target && !isListed) return false;

  await db
    .delete(verificationRevocations)
    .where(
      sql`lower(${verificationRevocations.username}) = ${username
        .trim()
        .toLowerCase()}`
    );

  if (target) {
    await db
      .insert(verifications)
      .values({ username: target.username, grantedBy })
      .onConflictDoNothing();
  }
  return true;
}

/**
 * Odebranie odznaki – działa dla każdego konta, także SweetieFox
 * i pozostałych nazw z listy startowej.
 */
export async function revokeVerification(
  username: string,
  revokedBy?: string
): Promise<void> {
  await ensureSchema();
  const name = username.trim();
  const lower = name.toLowerCase();
  await db
    .delete(verifications)
    .where(sql`lower(${verifications.username}) = ${lower}`);
  if (!name) return;
  await db
    .insert(verificationRevocations)
    .values({ username: name, revokedBy: revokedBy ?? null })
    .onConflictDoNothing();
}
