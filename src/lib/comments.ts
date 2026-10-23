import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { commentVotes, comments } from "@/db/schema";

/** Komentarz w formie wysyłanej do przeglądarki. */
export type CommentItem = {
  id: number;
  videoId: number;
  /** null = komentarz główny, liczba = odpowiedź na ten komentarz. */
  parentId: number | null;
  username: string;
  body: string;
  likes: number;
  dislikes: number;
  createdAt: string;
  myVote: "like" | "dislike" | null;
};

export function voteLabel(value: number | null | undefined): CommentItem["myVote"] {
  if (value === 1) return "like";
  if (value === -1) return "dislike";
  return null;
}

export const MAX_COMMENT_LENGTH = 1000;

/**
 * Lista komentarzy pod filmem (najnowsze pierwsze) wraz z głosem widza.
 * Odpowiedzi mają ustawione `parentId` – drzewo składamy w komponencie.
 */
export async function listComments(
  videoId: number,
  viewer: string | null
): Promise<CommentItem[]> {
  const rows = await db
    .select({
      id: comments.id,
      videoId: comments.videoId,
      parentId: comments.parentId,
      username: comments.username,
      body: comments.body,
      likes: comments.likes,
      dislikes: comments.dislikes,
      createdAt: comments.createdAt,
    })
    .from(comments)
    .where(eq(comments.videoId, videoId))
    .orderBy(desc(comments.createdAt))
    .limit(200);

  if (!rows.length) return [];

  const myVotes = new Map<number, number>();
  if (viewer) {
    const votes = await db
      .select({ commentId: commentVotes.commentId, value: commentVotes.value })
      .from(commentVotes)
      .where(
        and(
          eq(commentVotes.username, viewer),
          inArray(
            commentVotes.commentId,
            rows.map((r) => r.id)
          )
        )
      );
    for (const v of votes) myVotes.set(v.commentId, v.value);
  }

  return rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    myVote: voteLabel(myVotes.get(r.id)),
  }));
}
