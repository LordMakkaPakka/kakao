import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getUserFromRequest } from "@/lib/auth";
import { ensureSchema } from "@/lib/dbInit";
import { bannedResponse } from "@/lib/moderation";

const MAX_BIO = 600;

/** Zapis opisu profilu (widoczny publicznie na /u/<nick>). */
export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Zaloguj się." }, { status: 401 });

  const blocked = await bannedResponse(user);
  if (blocked) return blocked;

  const body = (await req.json().catch(() => null)) as { bio?: string | null } | null;
  if (!body || !("bio" in body)) {
    return NextResponse.json({ error: "Brak opisu." }, { status: 400 });
  }

  const raw = typeof body.bio === "string" ? body.bio.trim() : "";
  if (raw.length > MAX_BIO) {
    return NextResponse.json(
      { error: `Opis może mieć maksymalnie ${MAX_BIO} znaków.` },
      { status: 400 }
    );
  }

  const bio = raw.length ? raw : null;

  await ensureSchema();
  await db.update(users).set({ bio }).where(eq(users.username, user));
  return NextResponse.json({ ok: true, bio });
}
