import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { comments, videos } from "@/db/schema";
import { getUserFromRequest } from "@/lib/auth";
import { ensureSchema } from "@/lib/dbInit";
import { listComments, MAX_COMMENT_LENGTH } from "@/lib/comments";
import { isVerifiedAccount } from "@/lib/verification";

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
    | { body?: string; parentId?: number | null }
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

  const requestedParent = body?.parentId;
  let parentId: number | null = null;

  if (requestedParent !== undefined && requestedParent !== null) {
    const parentNumber = Number(requestedParent);
    if (!Number.isInteger(parentNumber) || parentNumber <= 0) {
      return NextResponse.json(
        { error: "Nieprawidłowy komentarz nadrzędny." },
        { status: 400 }
      );
    }
    const [parent] = await db
      .select({
        id: comments.id,
        videoId: comments.videoId,
        parentId: comments.parentId,
      })
      .from(comments)
      .where(eq(comments.id, parentNumber))
      .limit(1);
    if (!parent || parent.videoId !== videoId) {
      return NextResponse.json(
        { error: "Nie ma takiego komentarza." },
        { status: 404 }
      );
    }
    // Odpowiedzi mają maksymalnie jeden poziom – odpowiadając na odpowiedź,
    // przypinamy nowy wpis do jej komentarza głównego.
    parentId = parent.parentId ?? parent.id;
  }

  const [created] = await db
    .insert(comments)
    .values({ videoId, parentId, username: user, body: text })
    .returning();

  return NextResponse.json(
    {
      comment: {
        id: created.id,
        videoId: created.videoId,
        parentId: created.parentId,
        username: created.username,
        body: created.body,
        likes: created.likes,
        dislikes: created.dislikes,
        createdAt: created.createdAt.toISOString(),
        verified: await isVerifiedAccount(created.username),
        myVote: null,
      },
    },
    { status: 201 }
  );
}
