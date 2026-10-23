import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { isSensei, listUsersForAdmin } from "@/lib/verification";

/** Lista kont do panelu weryfikacji – tylko dla sensei69. */
export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Zaloguj się." }, { status: 401 });
  }
  if (!isSensei(user)) {
    return NextResponse.json(
      { error: "Tylko sensei69 może nadawać weryfikację." },
      { status: 403 }
    );
  }
  const list = await listUsersForAdmin();
  return NextResponse.json({ users: list });
}
