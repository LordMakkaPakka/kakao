import { NextResponse } from "next/server";
import { desc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { comments, users, verifications, videos } from "@/db/schema";
import { ensureSchema } from "@/lib/dbInit";
import { isSensei, isStaticVerified } from "@/lib/verified";
import { durationToMs, formatCountdown } from "@/lib/banTime";

export { BAN_UNITS, durationToMs, formatCountdown } from "@/lib/banTime";
export type { BanUnit } from "@/lib/banTime";
export { isSensei };

export type BanState = {
  banned: boolean;
  until: string | null;
  reason: string | null;
  remainingMs: number;
};

export async function getBanState(username: string): Promise<BanState> {
  await ensureSchema();
  const [row] = await db
    .select({ bannedUntil: users.bannedUntil, reason: users.banReason })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  const until = row?.bannedUntil ?? null;
  const remainingMs = until ? until.getTime() - Date.now() : 0;
  return {
    banned: !!until && remainingMs > 0,
    until: until ? until.toISOString() : null,
    reason: row?.reason ?? null,
    remainingMs: Math.max(0, remainingMs),
  };
}

export async function isBanned(
  username: string | null | undefined
): Promise<boolean> {
  if (!username) return false;
  const state = await getBanState(username);
  return state.banned;
}

/** Komunikat dla zbanowanego użytkownika (z czasem do końca bana). */
export function banMessage(state: BanState): string {
  return `zbanowane jeszcze na ${formatCountdown(state.remainingMs)}.${
    state.reason ? ` Powód: ${state.reason}.` : ""
  }`;
}

/** Odpowiedź 403, gdy konto ma aktywnego bana (albo null, gdy może działać). */
export async function bannedResponse(
  username: string | null | undefined
): Promise<NextResponse | null> {
  if (!username) return null;
  const state = await getBanState(username);
  if (!state.banned) return null;
  return NextResponse.json(
    { error: `Konto jest ${banMessage(state)}`, banned: true },
    { status: 403 }
  );
}

export async function banUser(
  username: string,
  durationMs: number,
  reason: string | null
): Promise<BanState | null> {
  await ensureSchema();
  const [existing] = await db
    .select({ username: users.username })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  if (!existing) return null;
  const until = new Date(Date.now() + durationMs);
  await db
    .update(users)
    .set({ bannedUntil: until, banReason: reason })
    .where(eq(users.username, username));
  return getBanState(username);
}

export async function unbanUser(username: string): Promise<boolean> {
  await ensureSchema();
  const updated = await db
    .update(users)
    .set({ bannedUntil: null, banReason: null })
    .where(eq(users.username, username))
    .returning({ username: users.username });
  return updated.length > 0;
}

export type AdminAccountRow = {
  username: string;
  verified: boolean;
  staticVerified: boolean;
  createdAt: string;
  hasAvatar: boolean;
  videos: number;
  comments: number;
  bannedUntil: string | null;
  banReason: string | null;
  remainingMs: number;
  /** Skrót hasła – hasła są hashowane, nie da się ich odczytać. */
  passwordFingerprint: string;
  sensei: boolean;
};

export type AdminVideoRow = {
  id: number;
  title: string;
  uploader: string;
  category: string;
  views: number;
  likes: number;
  dislikes: number;
  createdAt: string;
};

export type AdminCommentRow = {
  id: number;
  videoId: number;
  videoTitle: string;
  username: string;
  body: string;
  parentId: number | null;
  createdAt: string;
};

export async function listAccounts(): Promise<AdminAccountRow[]> {
  await ensureSchema();
  const rows = await db
    .select({
      username: users.username,
      passwordHash: users.passwordHash,
      avatar: users.avatar,
      bannedUntil: users.bannedUntil,
      banReason: users.banReason,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt))
    .limit(500);

  const vids = await db.select({ uploader: videos.uploader }).from(videos);
  const cmts = await db.select({ username: comments.username }).from(comments);
  const grantedRows = await db
    .select({ username: verifications.username })
    .from(verifications);

  const videoCount = new Map<string, number>();
  for (const v of vids)
    videoCount.set(v.uploader, (videoCount.get(v.uploader) ?? 0) + 1);
  const commentCount = new Map<string, number>();
  for (const c of cmts)
    commentCount.set(c.username, (commentCount.get(c.username) ?? 0) + 1);
  const granted = new Set(grantedRows.map((v) => v.username.toLowerCase()));

  return rows.map((row) => ({
    username: row.username,
    verified: granted.has(row.username.toLowerCase()),
    staticVerified: isStaticVerified(row.username),
    createdAt: row.createdAt.toISOString(),
    hasAvatar: !!row.avatar,
    videos: videoCount.get(row.username) ?? 0,
    comments: commentCount.get(row.username) ?? 0,
    bannedUntil: row.bannedUntil ? row.bannedUntil.toISOString() : null,
    banReason: row.banReason,
    remainingMs: row.bannedUntil
      ? Math.max(0, row.bannedUntil.getTime() - Date.now())
      : 0,
    passwordFingerprint: `${row.passwordHash.slice(0, 8)}…${row.passwordHash.slice(-4)}`,
    sensei: isSensei(row.username),
  }));
}

export async function listAllVideos(): Promise<AdminVideoRow[]> {
  await ensureSchema();
  const rows = await db
    .select({
      id: videos.id,
      title: videos.title,
      uploader: videos.uploader,
      category: videos.category,
      views: videos.views,
      likes: videos.likes,
      dislikes: videos.dislikes,
      createdAt: videos.createdAt,
    })
    .from(videos)
    .orderBy(desc(videos.createdAt))
    .limit(500);
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}

export async function listAllComments(): Promise<AdminCommentRow[]> {
  await ensureSchema();
  const rows = await db
    .select({
      id: comments.id,
      videoId: comments.videoId,
      videoTitle: videos.title,
      username: comments.username,
      body: comments.body,
      parentId: comments.parentId,
      createdAt: comments.createdAt,
    })
    .from(comments)
    .leftJoin(videos, eq(videos.id, comments.videoId))
    .orderBy(desc(comments.createdAt))
    .limit(500);
  return rows.map((r) => ({
    ...r,
    videoTitle: r.videoTitle ?? "(usunięty film)",
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function adminDeleteVideo(id: number): Promise<boolean> {
  await ensureSchema();
  const deleted = await db
    .delete(videos)
    .where(eq(videos.id, id))
    .returning({ id: videos.id });
  return deleted.length > 0;
}

export async function adminDeleteComment(id: number): Promise<boolean> {
  await ensureSchema();
  const deleted = await db
    .delete(comments)
    .where(eq(comments.id, id))
    .returning({ id: comments.id });
  return deleted.length > 0;
}

/** Usunięcie konta wraz z jego filmami, komentarzami i odznaką. */
export async function adminDeleteAccount(username: string): Promise<boolean> {
  await ensureSchema();
  const [existing] = await db
    .select({ username: users.username })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  if (!existing) return false;

  await db.delete(videos).where(eq(videos.uploader, username));
  await db.delete(comments).where(eq(comments.username, username));
  await db.delete(verifications).where(eq(verifications.username, username));
  await db.delete(users).where(eq(users.username, username));
  return true;
}

/** Liczba aktywnych banów (do podsumowania w panelu). */
export async function activeBanCount(): Promise<number> {
  await ensureSchema();
  const now = Date.now();
  const rows = await db
    .select({ bannedUntil: users.bannedUntil })
    .from(users)
    .where(isNotNull(users.bannedUntil));
  return rows.filter((r) => r.bannedUntil && r.bannedUntil.getTime() > now)
    .length;
}

export const banDurationToMs = durationToMs;
