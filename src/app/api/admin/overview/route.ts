import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import {
  activeBanCount,
  isAdmin,
  listAccounts,
  listAdmins,
  listAllComments,
  listAllVideos,
} from "@/lib/moderation";

/** Pełne dane panelu moderacji – sensei69 i admini. */
export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Zaloguj się." }, { status: 401 });
  if (!(await isAdmin(user))) {
    return NextResponse.json(
      { error: "Panel moderacji jest tylko dla adminów." },
      { status: 403 }
    );
  }

  const [accounts, videos, comments, bans, adminList] = await Promise.all([
    listAccounts(),
    listAllVideos(),
    listAllComments(),
    activeBanCount(),
    listAdmins(),
  ]);

  return NextResponse.json({
    accounts,
    videos,
    comments,
    activeBans: bans,
    admins: adminList,
    me: user,
  });
}
