import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getUserFromRequest, hashPassword } from "@/lib/auth";
import { ensureSchema } from "@/lib/dbInit";
import { isSensei } from "@/lib/verified";

/**
 * Zmiana hasła kontu (moderacja). Hasła w bazie są hashowane (scrypt),
 * więc nie da się ich podejrzeć – można je tylko zresetować.
 */
export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Zaloguj się." }, { status: 401 });
  if (!isSensei(user)) {
    return NextResponse.json(
      { error: "Tylko sensei69 może zmieniać hasła." },
      { status: 403 }
    );
  }

  const body = (await req.json().catch(() => null)) as
    | { username?: string; password?: string }
    | null;

  const username = body?.username?.trim();
  const password = body?.password;

  if (!username || !password) {
    return NextResponse.json(
      { error: "Podaj konto i nowe hasło." },
      { status: 400 }
    );
  }
  if (password.length < 4) {
    return NextResponse.json(
      { error: "Hasło musi mieć co najmniej 4 znaki." },
      { status: 400 }
    );
  }

  await ensureSchema();
  const updated = await db
    .update(users)
    .set({ passwordHash: hashPassword(password) })
    .where(eq(users.username, username))
    .returning({ username: users.username });

  if (!updated.length) {
    return NextResponse.json({ error: "Nie ma takiego konta." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, username });
}
