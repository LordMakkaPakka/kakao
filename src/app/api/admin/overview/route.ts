import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { isSensei } from "@/lib/verified";
import {
  activeBanCount,
  listAccounts,
  listAllComments,
  listAllVideos,
} from "@/lib/moderation";

/** Pełne dane panelu moderacji – tylko sensei69. */
export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Zaloguj się." }, { status: 401 });
  if (!isSensei(user)) {
    return NextResponse.json(
      { error: "Panel moderacji jest tylko dla sensei69." },
      { status: 403 }
    );
  }

  const [accounts, videos, comments, bans] = await Promise.all([
    listAccounts(),
    listAllVideos(),
    listAllComments(),
    activeBanCount(),
  ]);

  return NextResponse.json({ accounts, videos, comments, activeBans: bans });
}
