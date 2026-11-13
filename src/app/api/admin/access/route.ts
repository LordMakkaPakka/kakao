import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { isSensei } from "@/lib/verified";
import { listAccess, revokeAccess, telegramConfigured } from "@/lib/telegram";

/**
 * Dostęp do serwisu (bramka Telegram) — tylko `sensei69`.
 *
 * GET  – lista kont z odblokowanym dostępem.
 * POST – `{ username }` odbiera dostęp; konto musi znów napisać do bota
 *        po nowy kod i wpisać go na stronie.
 */
export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Zaloguj się." }, { status: 401 });
  if (!isSensei(user)) {
    return NextResponse.json(
      { error: "Tylko sensei69 widzi listę dostępów." },
      { status: 403 }
    );
  }
  return NextResponse.json({
    configured: telegramConfigured(),
    access: await listAccess(),
  });
}

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Zaloguj się." }, { status: 401 });
  if (!isSensei(user)) {
    return NextResponse.json(
      { error: "Tylko sensei69 może odbierać dostęp." },
      { status: 403 }
    );
  }

  const body = (await req.json().catch(() => null)) as { username?: string } | null;
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  if (!username) {
    return NextResponse.json({ error: "Podaj nazwę konta." }, { status: 400 });
  }
  if (/^sensei69$/i.test(username)) {
    return NextResponse.json(
      { error: "sensei69 ma dostęp zawsze — nie da się go odebrać." },
      { status: 400 }
    );
  }

  const removed = await revokeAccess(username);
  if (!removed) {
    return NextResponse.json(
      { error: "To konto nie ma odblokowanego dostępu." },
      { status: 404 }
    );
  }
  return NextResponse.json({ ok: true, username });
}
