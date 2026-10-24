import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getUserFromRequest } from "@/lib/auth";
import { ensureSchema } from "@/lib/dbInit";
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
      bio: null,
      bannedUntil: null,
      banReason: null,
      remainingMs: 0,
    });
  }
  await ensureSchema();
  const [verified, ban, admin, row] = await Promise.all([
    isVerifiedAccount(user),
    getBanState(user),
    isAdmin(user),
    db
      .select({ bio: users.bio })
      .from(users)
      .where(eq(users.username, user))
      .limit(1),
  ]);
  return NextResponse.json({
    user,
    verified,
    sensei: isSensei(user),
    admin,
    bio: row[0]?.bio ?? null,
    bannedUntil: ban.until,
    banReason: ban.reason,
    remainingMs: ban.remainingMs,
  });
}
