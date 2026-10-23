import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { comments, videos } from "@/db/schema";
import { getUserFromRequest } from "@/lib/auth";
import { ensureSchema } from "@/lib/dbInit";
import { listComments, MAX_COMMENT_LENGTH } from "@/lib/comments";

/** Lista komentarzy pod filmem. */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const videoId = Number(id);
  if (!Number.isInteger(videoId)) {
    return NextResponse.json({ error: "Zły identyfikator." }, { status: 400 });
  }
  await ensureSchema();
  const viewer = getUserFromRequest(req);
  const rows = await listComments(videoId, viewer);
  return NextResponse.json({ comments: rows });
}

/** Dodanie komentarza – wymaga zalogowania. */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const user = getUserFromRequest(req);
  if (!user) {
    return NextResponse.json(
      { error: "Musisz się zalogować, aby komentować." },
      { status: 401 }
    );
  }

  const { id } = await ctx.params;
  const videoId = Number(id);
  if (!Number.isInteger(videoId)) {
    return NextResponse.json({ error: "Zły identyfikator." }, { status: 400 });
  }

  const body = (await req.json().catch(() => null)) as
    | { body?: string }
    | null;
  const text = String(body?.body ?? "").trim().replace(/\s{3,}/g, "\n\n");

  if (!text) {
    return NextResponse.json(
      { error: "Komentarz nie może być pusty." },
      { status: 400 }
    );
  }
  if (text.length > MAX_COMMENT_LENGTH) {
    return NextResponse.json(
      { error: `Komentarz może mieć maksymalnie ${MAX_COMMENT_LENGTH} znaków.` },
      { status: 400 }
    );
  }

  await ensureSchema();

  const [video] = await db
    .select({ id: videos.id })
    .from(videos)
    .where(eq(videos.id, videoId))
    .limit(1);
  if (!video) {
    return NextResponse.json({ error: "Nie ma takiego filmu." }, { status: 404 });
  }

  const [created] = await db
    .insert(comments)
    .values({ videoId, username: user, body: text })
    .returning();

  return NextResponse.json(
    {
      comment: {
        id: created.id,
        videoId: created.videoId,
        username: created.username,
        body: created.body,
        likes: created.likes,
        dislikes: created.dislikes,
        createdAt: created.createdAt.toISOString(),
        myVote: null,
      },
    },
    { status: 201 }
  );
}
