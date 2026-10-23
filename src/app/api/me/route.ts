import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { isVerifiedAccount } from "@/lib/verification";
import { getBanState, isAdmin } from "@/lib/moderation";
import { isSensei } from "@/lib/verified";

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({
      user: null,
      verified: false,
      sensei: false,
      admin: false,
      bannedUntil: null,
      banReason: null,
      remainingMs: 0,
    });
  }
  const [verified, ban, admin] = await Promise.all([
    isVerifiedAccount(user),
    getBanState(user),
    isAdmin(user),
  ]);
  return NextResponse.json({
    user,
    verified,
    sensei: isSensei(user),
    admin,
    bannedUntil: ban.until,
    banReason: ban.reason,
    remainingMs: ban.remainingMs,
  });
}
