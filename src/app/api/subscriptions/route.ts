import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { listMySubscriptions } from "@/lib/subscriptions";

/** Kanały subskrybowane przez zalogowane konto. */
export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) {
    return NextResponse.json(
      { error: "Zaloguj się, aby zobaczyć swoje subskrypcje." },
      { status: 401 }
    );
  }
  const channels = await listMySubscriptions(user);
  return NextResponse.json({ channels });
}
