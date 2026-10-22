import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { ensureSchema } from "@/lib/dbInit";

export const SESSION_COOKIE = "polhub_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

/** Opcje ciasteczka działające także w podglądzie w iframe (cross-site). */
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "none" as const,
  secure: true,
  path: "/",
  maxAge: SESSION_MAX_AGE,
};

const SECRET = "polhub-tajny-klucz-sesji-2026-v2";

const FOUNDER_USERNAME = "Gnam";
const FOUNDER_PASSWORD = "dupa213";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return (
    candidate.length === expected.length && timingSafeEqual(candidate, expected)
  );
}

export async function ensureFounderUser() {
  await ensureSchema();
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, FOUNDER_USERNAME))
    .limit(1);
  if (!existing) {
    await db
      .insert(users)
      .values({
        username: FOUNDER_USERNAME,
        passwordHash: hashPassword(FOUNDER_PASSWORD),
      })
      .onConflictDoNothing();
  }
}

export async function findUser(username: string) {
  await ensureSchema();
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  return user ?? null;
}

export function createSessionToken(username: string): string {
  const sig = createHmac("sha256", SECRET).update(username).digest("hex");
  return `${encodeURIComponent(username)}.${sig}`;
}

export function parseSessionToken(token: string | undefined | null): string | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const encodedName = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  let username: string;
  try {
    username = decodeURIComponent(encodedName);
  } catch {
    return null;
  }
  const expected = createHmac("sha256", SECRET).update(username).digest("hex");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return username;
}

/** Sesja z ciasteczka (komponenty serwerowe). */
export async function getSessionUser(): Promise<string | null> {
  const store = await cookies();
  return parseSessionToken(store.get(SESSION_COOKIE)?.value);
}

/** Sesja z ciasteczka LUB nagłówka Authorization (gdy przeglądarka blokuje ciasteczka). */
export function getUserFromRequest(req: NextRequest): string | null {
  const fromCookie = parseSessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (fromCookie) return fromCookie;
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    return parseSessionToken(auth.slice(7).trim());
  }
  return null;
}