import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { listUsersForAdmin } from "@/lib/verification";
import { isAdmin } from "@/lib/moderation";

/** Lista kont do panelu weryfikacji – tylko dla sensei69. */
export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Zaloguj się." }, { status: 401 });
  }
  if (!(await isAdmin(user))) {
    return NextResponse.json(
      { error: "Tylko moderatorzy mają dostęp do listy kont." },
      { status: 403 }
    );
  }
  const list = await listUsersForAdmin();
  return NextResponse.json({ users: list });
}
