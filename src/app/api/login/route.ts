import { NextRequest, NextResponse } from "next/server";
import {
  createSessionToken,
  ensureFounderUser,
  findUser,
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
  verifyPassword,
} from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as
    | { username?: string; password?: string }
    | null;

  const username = body?.username?.trim();
  const password = body?.password;

  if (!username || !password) {
    return NextResponse.json({ error: "Podaj login i hasło." }, { status: 400 });
  }

  await ensureFounderUser();
  const user = await findUser(username);

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json(
      { error: "Nieprawidłowy login lub hasło." },
      { status: 401 }
    );
  }

  const token = createSessionToken(user.username);
  const res = NextResponse.json({ ok: true, user: user.username, token });
  res.cookies.set(SESSION_COOKIE, token, SESSION_COOKIE_OPTIONS);
  return res;
}