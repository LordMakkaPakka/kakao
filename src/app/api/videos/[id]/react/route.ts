import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { videos } from "@/db/schema";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const videoId = Number(id);
  const body = (await req.json().catch(() => null)) as
    | { type?: "like" | "dislike" }
    | null;

  if (!Number.isInteger(videoId) || !body?.type) {
    return NextResponse.json({ error: "Nieprawidłowe dane." }, { status: 400 });
  }

  const column = body.type === "like" ? videos.likes : videos.dislikes;
  const [row] = await db
    .update(videos)
    .set({ [body.type === "like" ? "likes" : "dislikes"]: sql`${column} + 1` })
    .where(eq(videos.id, videoId))
    .returning({ likes: videos.likes, dislikes: videos.dislikes });

  if (!row) return NextResponse.json({ error: "Nie znaleziono." }, { status: 404 });
  return NextResponse.json(row);
}