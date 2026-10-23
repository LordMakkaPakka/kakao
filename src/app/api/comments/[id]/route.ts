import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { comments } from "@/db/schema";
import { getUserFromRequest } from "@/lib/auth";
import { ensureSchema } from "@/lib/dbInit";

/** Usunięcie własnego komentarza (razem z odpowiedziami). */
export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const user = getUserFromRequest(req);
  if (!user) {
    return NextResponse.json(
      { error: "Musisz się zalogować, aby usuwać komentarze." },
      { status: 401 }
    );
  }

  const { id } = await ctx.params;
  const commentId = Number(id);
  if (!Number.isInteger(commentId) || commentId <= 0) {
    return NextResponse.json({ error: "Zły identyfikator." }, { status: 400 });
  }

  await ensureSchema();

  const deleted = await db
    .delete(comments)
    .where(and(eq(comments.id, commentId), eq(comments.username, user)))
    .returning({ id: comments.id, parentId: comments.parentId });

  if (deleted.length === 0) {
    const [existing] = await db
      .select({ id: comments.id, username: comments.username })
      .from(comments)
      .where(eq(comments.id, commentId))
      .limit(1);
    if (!existing) {
      return NextResponse.json(
        { error: "Nie ma takiego komentarza." },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Możesz usuwać tylko własne komentarze." },
      { status: 403 }
    );
  }

  return NextResponse.json({ ok: true, id: deleted[0].id });
}
