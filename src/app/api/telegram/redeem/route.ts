import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { bannedResponse } from "@/lib/moderation";
import { ensureSchema } from "@/lib/dbInit";
import { gateEnabled, redeemCode, telegramStatus } from "@/lib/telegram";

/**
 * Wpisanie kodu z Telegrama. Kod pochodzi od bota — użytkownik najpierw
 * pisze do niego `/start`, dostaje 6-znakowy kod i wkleja go tutaj.
 */
export async function POST(req: NextRequest) {
  await ensureSchema();
  if (!gateEnabled()) {
    return NextResponse.json(
      { error: "Dostęp przez Telegram nie jest włączony na tym serwisie." },
      { status: 400 }
    );
  }

  const user = getUserFromRequest(req);
  if (!user) {
    return NextResponse.json(
      { error: "Zaloguj się, żeby wpisać kod." },
      { status: 401 }
    );
  }

  const blocked = await bannedResponse(user);
  if (blocked) return blocked;

  const body = (await req.json().catch(() => null)) as { code?: string } | null;
  const code = typeof body?.code === "string" ? body.code : "";
  if (!code.trim()) {
    return NextResponse.json({ error: "Wpisz kod z Telegrama." }, { status: 400 });
  }

  const result = await redeemCode(user, code);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const status = await telegramStatus(user);
  return NextResponse.json({
    ok: true,
    telegramUsername: result.telegramUsername,
    status,
  });
}
