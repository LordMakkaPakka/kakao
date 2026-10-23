import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { isSensei } from "@/lib/verified";
import { adminDeleteAccount, adminDeleteComment, adminDeleteVideo } from "@/lib/moderation";

/**
 * Usuwanie treści z panelu moderacji – tylko sensei69.
 * type: "video" | "comment" | "account", id (dla konta: nazwa użytkownika).
 */
export async function DELETE(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Zaloguj się." }, { status: 401 });
  if (!isSensei(user)) {
    return NextResponse.json(
      { error: "Tylko sensei69 może usuwać treści." },
      { status: 403 }
    );
  }

  const type = req.nextUrl.searchParams.get("type");
  const rawId = req.nextUrl.searchParams.get("id");
  if (!type || !rawId) {
    return NextResponse.json({ error: "Brak typu lub identyfikatora." }, { status: 400 });
  }

  if (type === "account") {
    const username = decodeURIComponent(rawId);
    if (isSensei(username)) {
      return NextResponse.json(
        { error: "Nie można usunąć konta sensei69." },
        { status: 400 }
      );
    }
    const ok = await adminDeleteAccount(username);
    if (!ok) {
      return NextResponse.json({ error: "Nie ma takiego konta." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, type, id: username });
  }

  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Zły identyfikator." }, { status: 400 });
  }

  const ok =
    type === "video"
      ? await adminDeleteVideo(id)
      : type === "comment"
        ? await adminDeleteComment(id)
        : false;

  if (type !== "video" && type !== "comment") {
    return NextResponse.json({ error: "Nieznany typ." }, { status: 400 });
  }
  if (!ok) {
    return NextResponse.json({ error: "Nie znaleziono." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, type, id });
}
