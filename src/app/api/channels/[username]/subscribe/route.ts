import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { bannedResponse } from "@/lib/moderation";
import {
  getSubscribeState,
  resolveChannel,
  toggleSubscription,
} from "@/lib/subscriptions";

/**
 * Subskrypcja kanału: POST przełącza (subskrybuj / odsubskrybuj).
 * Kanał podajemy w ścieżce: /api/channels/<nick>/subscribe
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ username: string }> }
) {
  const user = getUserFromRequest(req);
  if (!user) {
    return NextResponse.json(
      { error: "Zaloguj się, aby subskrybować kanały." },
      { status: 401 }
    );
  }

  const blocked = await bannedResponse(user);
  if (blocked) return blocked;

  const { username } = await ctx.params;
  const channel = decodeURIComponent(username ?? "").trim();
  if (!channel) {
    return NextResponse.json({ error: "Nie ma takiego kanału." }, { status: 400 });
  }
  if (channel.toLowerCase() === user.trim().toLowerCase()) {
    return NextResponse.json(
      { error: "Nie możesz subskrybować własnego kanału." },
      { status: 400 }
    );
  }
  const canonical = await resolveChannel(channel);
  if (!canonical) {
    return NextResponse.json({ error: "Nie ma takiego kanału." }, { status: 404 });
  }

  const state = await toggleSubscription(user, canonical);
  return NextResponse.json({ ok: true, channel: canonical, ...state });
}

/** Stan subskrypcji kanału (dla zalogowanego widza). */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ username: string }> }
) {
  const { username } = await ctx.params;
  const channel = decodeURIComponent(username ?? "").trim();
  if (!channel) {
    return NextResponse.json({ error: "Nie ma takiego kanału." }, { status: 400 });
  }
  const user = getUserFromRequest(req);
  const state = await getSubscribeState(channel, user);
  return NextResponse.json({ channel, ...state });
}
