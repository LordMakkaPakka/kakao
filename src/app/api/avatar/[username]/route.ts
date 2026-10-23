import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { ensureSchema } from "@/lib/dbInit";

/** Publiczne zdjęcie profilowe użytkownika (404 gdy brak). */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ username: string }> }
) {
  const { username } = await ctx.params;
  await ensureSchema();
  const [row] = await db
    .select({ avatar: users.avatar })
    .from(users)
    .where(eq(users.username, decodeURIComponent(username)))
    .limit(1);
  const m = row?.avatar && /^data:(image\/[a-z]+);base64,(.*)$/.exec(row.avatar);
  if (!m) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(Buffer.from(m[2], "base64")), {
    headers: { "Content-Type": m[1], "Cache-Control": "no-cache" },
  });
}
