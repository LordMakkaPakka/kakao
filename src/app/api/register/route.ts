import { NextRequest, NextResponse } from "next/server";
import {
  createSessionToken,
  ensureFounderUser,
  findUser,
  hashPassword,
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
} from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as
    | { username?: string; password?: string }
    | null;

  const username = body?.username?.trim();
  const password = body?.password;

  if (!username || !password) {
    return NextResponse.json(
      { error: "Podaj nazwę użytkownika i hasło." },
      { status: 400 }
    );
  }
  if (!/^[a-zA-Z0-9_ąćęłńóśźżĄĆĘŁŃÓŚŻ-]{3,24}$/.test(username)) {
    return NextResponse.json(
      {
        error:
          "Nazwa użytkownika: 3–24 znaki, tylko litery, cyfry, myślnik i podkreślnik.",
      },
      { status: 400 }
    );
  }
  if (password.length < 4) {
    return NextResponse.json(
      { error: "Hasło musi mieć co najmniej 4 znaki." },
      { status: 400 }
    );
  }

  await ensureFounderUser();

  if (await findUser(username)) {
    return NextResponse.json(
      { error: "Ta nazwa użytkownika jest już zajęta." },
      { status: 409 }
    );
  }

  try {
    await db.insert(users).values({ username, passwordHash: hashPassword(password) });
  } catch {
    return NextResponse.json(
      { error: "Ta nazwa użytkownika jest już zajęta." },
      { status: 409 }
    );
  }

  // Automatyczne zalogowanie po rejestracji
  const token = createSessionToken(username);
  const res = NextResponse.json({ ok: true, user: username, token });
  res.cookies.set(SESSION_COOKIE, token, SESSION_COOKIE_OPTIONS);
  return res;
}