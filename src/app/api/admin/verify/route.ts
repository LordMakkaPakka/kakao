import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { isSensei } from "@/lib/verified";
import { isAdmin } from "@/lib/moderation";
import { grantVerification, revokeVerification } from "@/lib/verification";

/** Nadanie lub odebranie odznaki weryfikacji – sensei69 i admini. */
export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Zaloguj się." }, { status: 401 });
  }
  if (!(await isAdmin(user))) {
    return NextResponse.json(
      { error: "Tylko moderatorzy mogą zmieniać weryfikację." },
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

  if (isSensei(username)) {
    return NextResponse.json(
      { error: "Odznaki sensei69 nie można zmieniać." },
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
    // sensei69 może odebrać odznakę każdemu – także SweetieFox.
    await revokeVerification(username, user);
  }

  return NextResponse.json({ ok: true, username, verified });
}
