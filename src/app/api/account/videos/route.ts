import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { users, videos } from "@/db/schema";
import { getUserFromRequest } from "@/lib/auth";
import { ensureSchema } from "@/lib/dbInit";
import { isVerifiedAccount } from "@/lib/verification";
import { getBanState } from "@/lib/moderation";

/** Dane konta: zdjęcie profilowe + własne filmy. */
export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Zaloguj się." }, { status: 401 });
  await ensureSchema();

  const [me] = await db
    .select({ avatar: users.avatar })
    .from(users)
    .where(eq(users.username, user))
    .limit(1);

  const list = await db
    .select({
      id: videos.id,
      title: videos.title,
      thumbnail: videos.thumbnail,
      views: videos.views,
      createdAt: videos.createdAt,
    })
    .from(videos)
    .where(eq(videos.uploader, user))
    .orderBy(desc(videos.createdAt));

  const ban = await getBanState(user);

  return NextResponse.json({
    user,
    avatar: me?.avatar ?? null,
    verified: await isVerifiedAccount(user),
    banned: ban.banned,
    banReason: ban.reason,
    remainingMs: ban.remainingMs,
    videos: list,
  });
}
