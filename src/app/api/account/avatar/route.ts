import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getUserFromRequest } from "@/lib/auth";
import { ensureSchema } from "@/lib/dbInit";

const MAX_LEN = 400_000; // ~300 KB obrazka

/** Ustaw zdjęcie profilowe (data URL) lub usuń je (avatar: null). */
export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Zaloguj się." }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { avatar?: string | null } | null;
  const avatar = body?.avatar ?? null;
  if (avatar !== null) {
    if (typeof avatar !== "string" || !/^data:image\/(png|jpeg|webp);base64,/.test(avatar)) {
      return NextResponse.json({ error: "Nieprawidłowy obrazek." }, { status: 400 });
    }
    if (avatar.length > MAX_LEN) {
      return NextResponse.json({ error: "Obrazek jest za duży." }, { status: 413 });
    }
  }

  await ensureSchema();
  await db.update(users).set({ avatar }).where(eq(users.username, user));
  return NextResponse.json({ ok: true, avatar });
}
