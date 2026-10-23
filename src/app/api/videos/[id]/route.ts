import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { videos } from "@/db/schema";
import { getUserFromRequest } from "@/lib/auth";

/** Usuń własny film. */
export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Zaloguj się." }, { status: 401 });
  const { id } = await ctx.params;
  const videoId = Number(id);
  if (!Number.isInteger(videoId)) {
    return NextResponse.json({ error: "Zły identyfikator." }, { status: 400 });
  }
  const deleted = await db
    .delete(videos)
    .where(and(eq(videos.id, videoId), eq(videos.uploader, user)))
    .returning({ id: videos.id });
  if (!deleted.length) {
    return NextResponse.json({ error: "Nie znaleziono Twojego filmu." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
