import { NextRequest, NextResponse } from "next/server";
import { ensureSchema } from "@/lib/dbInit";
import { pollBotUpdates, telegramConfigured } from "@/lib/telegram";

export const dynamic = "force-dynamic";

/**
 * Odbieranie wiadomości z Telegrama.
 *
 * Wywoływane przez cron (Vercel → `vercel.json`) oraz doraźnie — serwer sam
 * odbiera wiadomości także przy wpisywaniu kodu, więc użytkownik nie czeka
 * na harmonogram. Gdy ustawisz `CRON_SECRET`, endpoint przyjmie tylko
 * żądania z tym nagłówkiem (lub od samego Vercela).
 */
async function handle(req: NextRequest) {
  if (!telegramConfigured()) {
    return NextResponse.json({ ok: false, error: "Brak TELEGRAM_BOT_TOKEN." }, { status: 400 });
  }

  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    const isCron = req.headers.get("x-vercel-cron") === "1";
    if (!isCron && auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Brak dostępu." }, { status: 401 });
    }
  }

  await ensureSchema();
  try {
    const handled = await pollBotUpdates(true);
    return NextResponse.json({ ok: true, handled });
  } catch (err) {
    console.error("[polhub] poll bota nie powiódł się:", err);
    return NextResponse.json({ ok: false, error: "Błąd Telegrama." }, { status: 502 });
  }
}

export const GET = handle;
export const POST = handle;
