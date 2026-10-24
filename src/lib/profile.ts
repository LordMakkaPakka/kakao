import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { users, videos } from "@/db/schema";
import { ensureSchema } from "@/lib/dbInit";
import { getVerifiedSet } from "@/lib/verification";
import { getAdminSet } from "@/lib/moderation";
import { isSensei, isStaticVerified } from "@/lib/verified";

/** Film na profilu użytkownika. */
export type ProfileVideo = {
  id: number;
  title: string;
  category: string;
  uploader: string;
  uploaderVerified: boolean;
  durationSeconds: number;
  thumbnail: string | null;
  views: number;
  likes: number;
  dislikes: number;
  createdAt: Date;
};

export type UserProfile = {
  username: string;
  avatar: string | null;
  bio: string | null;
  verified: boolean;
  staticVerified: boolean;
  sensei: boolean;
  admin: boolean;
  /** Konto istnieje w bazie (false = nick tylko z listy startowej). */
  registered: boolean;
  createdAt: string | null;
  videos: ProfileVideo[];
  totalViews: number;
  totalLikes: number;
};

/**
 * Publiczny profil użytkownika: opis, odznaki i wszystkie jego filmy.
 * Zwraca null, gdy takiego konta nigdzie nie ma.
 */
export async function getProfile(
  rawUsername: string
): Promise<UserProfile | null> {
  await ensureSchema();
  const username = rawUsername.trim();
  if (!username) return null;

  // Najpierw dokładna nazwa, potem wariant bez rozróżniania wielkości liter
  // (w bazie mogą obok siebie istnieć np. „Gnam" i „gnam").
  const lookup = await db
    .select({
      username: users.username,
      avatar: users.avatar,
      bio: users.bio,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(sql`lower(${users.username}) = ${username.toLowerCase()}`)
    .limit(5);
  const row =
    lookup.find((r) => r.username === username) ?? lookup[0] ?? null;

  const [verifiedSet, adminSet] = await Promise.all([
    getVerifiedSet(),
    getAdminSet(),
  ]);

  const isListed = isStaticVerified(username);
  if (!row && !isListed) return null;

  const name = row?.username ?? username;
  const lower = name.toLowerCase();
  const list = await db
    .select({
      id: videos.id,
      title: videos.title,
      category: videos.category,
      uploader: videos.uploader,
      durationSeconds: videos.durationSeconds,
      thumbnail: videos.thumbnail,
      views: videos.views,
      likes: videos.likes,
      dislikes: videos.dislikes,
      createdAt: videos.createdAt,
    })
    .from(videos)
    .where(sql`lower(${videos.uploader}) = ${lower}`)
    .orderBy(desc(videos.createdAt))
    .limit(200);

  const profileVideos: ProfileVideo[] = list.map((v) => ({
    ...v,
    uploaderVerified: verifiedSet.has(v.uploader.toLowerCase()),
  }));

  return {
    username: name,
    avatar: row?.avatar ?? null,
    bio: row?.bio?.trim() ? row.bio.trim() : null,
    verified: verifiedSet.has(lower),
    staticVerified: isListed,
    sensei: isSensei(name),
    admin: adminSet.has(lower),
    registered: !!row,
    createdAt: row ? row.createdAt.toISOString() : null,
    videos: profileVideos,
    totalViews: profileVideos.reduce((sum, v) => sum + v.views, 0),
    totalLikes: profileVideos.reduce((sum, v) => sum + v.likes, 0),
  };
}
