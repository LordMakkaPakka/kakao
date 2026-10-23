import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { isVerifiedAccount, isSensei } from "@/lib/verification";
import { getBanState } from "@/lib/moderation";

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({
      user: null,
      verified: false,
      sensei: false,
      bannedUntil: null,
      banReason: null,
      remainingMs: 0,
    });
  }
  const [verified, ban] = await Promise.all([
    isVerifiedAccount(user),
    getBanState(user),
  ]);
  return NextResponse.json({
    user,
    verified,
    sensei: isSensei(user),
    bannedUntil: ban.until,
    banReason: ban.reason,
    remainingMs: ban.remainingMs,
  });
}
