import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { commentVotes, comments } from "@/db/schema";
import { getUserFromRequest } from "@/lib/auth";
import { ensureSchema } from "@/lib/dbInit";
import { voteLabel } from "@/lib/comments";

/**
 * Polubienie / odrzucenie komentarza.
 * Kliknięcie tej samej oceny drugi raz cofa głos – jeden głos na konto.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const user = getUserFromRequest(req);
  if (!user) {
    return NextResponse.json(
      { error: "Zaloguj się, aby oceniać komentarze." },
      { status: 401 }
    );
  }

  const { id } = await ctx.params;
  const commentId = Number(id);
  const payload = (await req.json().catch(() => null)) as
    | { type?: "like" | "dislike" }
    | null;

  if (
    !Number.isInteger(commentId) ||
    (payload?.type !== "like" && payload?.type !== "dislike")
  ) {
    return NextResponse.json({ error: "Nieprawidłowe dane." }, { status: 400 });
  }

  await ensureSchema();
  const wanted = payload.type === "like" ? 1 : -1;

  const result = await db.transaction(async (tx) => {
    const [comment] = await tx
      .select({ id: comments.id })
      .from(comments)
      .where(eq(comments.id, commentId))
      .limit(1);
    if (!comment) return null;

    const [existing] = await tx
      .select({ id: commentVotes.id, value: commentVotes.value })
      .from(commentVotes)
      .where(
        and(
          eq(commentVotes.commentId, commentId),
          eq(commentVotes.username, user)
        )
      )
      .limit(1);

    let next: number | null = wanted;

    if (!existing) {
      await tx
        .insert(commentVotes)
        .values({ commentId, username: user, value: wanted });
    } else if (existing.value === wanted) {
      await tx.delete(commentVotes).where(eq(commentVotes.id, existing.id));
      next = null;
    } else {
      await tx
        .update(commentVotes)
        .set({ value: wanted })
        .where(eq(commentVotes.id, existing.id));
    }

    const [counts] = await tx
      .select({
        likes: sql<number>`count(*) filter (where ${commentVotes.value} = 1)`.mapWith(
          Number
        ),
        dislikes:
          sql<number>`count(*) filter (where ${commentVotes.value} = -1)`.mapWith(
            Number
          ),
      })
      .from(commentVotes)
      .where(eq(commentVotes.commentId, commentId));

    await tx
      .update(comments)
      .set({ likes: counts?.likes ?? 0, dislikes: counts?.dislikes ?? 0 })
      .where(eq(comments.id, commentId));

    return {
      likes: counts?.likes ?? 0,
      dislikes: counts?.dislikes ?? 0,
      myVote: voteLabel(next),
    };
  });

  if (!result) {
    return NextResponse.json(
      { error: "Nie ma takiego komentarza." },
      { status: 404 }
    );
  }
  return NextResponse.json(result);
}
