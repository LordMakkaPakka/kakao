import { NextRequest, NextResponse } from "next/server";
import { and, desc, ilike, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { videos } from "@/db/schema";
import { ensureSchema } from "@/lib/dbInit";

export async function GET(req: NextRequest) {
  await ensureSchema();
  const q = req.nextUrl.searchParams.get("q")?.trim();
  const rows = await db
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
    // Pokazujemy tylko filmy z embedem — wgrywanie plików zostało wyłączone.
    .where(q ? and(isNotNull(videos.embedUrl), ilike(videos.title, `%${q}%`)) : isNotNull(videos.embedUrl))
    .orderBy(desc(videos.createdAt))
    .limit(60);

  return NextResponse.json({ videos: rows });
}
