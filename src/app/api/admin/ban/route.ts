import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { isSensei } from "@/lib/verified";
import {
  BAN_UNITS,
  banUser,
  durationToMs,
  type BanUnit,
  unbanUser,
} from "@/lib/moderation";

/** Ban / odbanowanie konta – tylko sensei69. */
export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Zaloguj się." }, { status: 401 });
  if (!isSensei(user)) {
    return NextResponse.json(
      { error: "Tylko sensei69 może banować konta." },
      { status: 403 }
    );
  }

  const body = (await req.json().catch(() => null)) as
    | {
        username?: string;
        action?: "ban" | "unban";
        value?: number;
        unit?: BanUnit;
        reason?: string;
      }
    | null;

  const username = body?.username?.trim();
  if (!username) {
    return NextResponse.json({ error: "Podaj nazwę konta." }, { status: 400 });
  }
  if (isSensei(username)) {
    return NextResponse.json(
      { error: "Nie można banować konta sensei69." },
      { status: 400 }
    );
  }

  if (body?.action === "unban") {
    const ok = await unbanUser(username);
    if (!ok) {
      return NextResponse.json({ error: "Nie ma takiego konta." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, username, banned: false });
  }

  const value = Number(body?.value);
  const unit = body?.unit;
  if (!Number.isFinite(value) || value <= 0 || !unit) {
    return NextResponse.json(
      { error: "Podaj czas bana i jednostkę." },
      { status: 400 }
    );
  }
  if (!BAN_UNITS.some((u) => u.value === unit)) {
    return NextResponse.json({ error: "Zła jednostka czasu." }, { status: 400 });
  }

  const durationMs = durationToMs(value, unit);
  const reason = body?.reason?.trim() ? String(body.reason).slice(0, 300) : null;
  const state = await banUser(username, durationMs, reason);
  if (!state) {
    return NextResponse.json({ error: "Nie ma takiego konta." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, username, banned: true, ban: state });
}
