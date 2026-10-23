import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import {
  grantVerification,
  isSensei,
  isStaticVerified,
  revokeVerification,
} from "@/lib/verification";

/** Nadanie lub odebranie odznaki weryfikacji – tylko dla sensei69. */
export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Zaloguj się." }, { status: 401 });
  }
  if (!isSensei(user)) {
    return NextResponse.json(
      { error: "Tylko sensei69 może nadawać weryfikację." },
      { status: 403 }
    );
  }

  const body = (await req.json().catch(() => null)) as
    | { username?: string; verified?: boolean }
    | null;

  const username = body?.username?.trim();
  const verified = body?.verified;

  if (!username || typeof verified !== "boolean") {
    return NextResponse.json({ error: "Nieprawidłowe dane." }, { status: 400 });
  }

  if (!verified && isStaticVerified(username)) {
    return NextResponse.json(
      { error: "Tej odznaki nie można odebrać – jest nadana na stałe." },
      { status: 400 }
    );
  }

  if (verified) {
    const ok = await grantVerification(username, user);
    if (!ok) {
      return NextResponse.json(
        { error: "Nie ma takiego konta." },
        { status: 404 }
      );
    }
  } else {
    await revokeVerification(username);
  }

  return NextResponse.json({ ok: true, username, verified });
}
