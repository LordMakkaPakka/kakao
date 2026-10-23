import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { isVerifiedAccount, isSensei } from "@/lib/verification";

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ user: null, verified: false, sensei: false });
  const [verified] = await Promise.all([isVerifiedAccount(user)]);
  return NextResponse.json({ user, verified, sensei: isSensei(user) });
}
