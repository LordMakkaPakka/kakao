import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { isSensei } from "@/lib/verified";
import { grantAdmin, listAdmins, revokeAdmin } from "@/lib/moderation";

/**
 * Nadawanie i odbieranie uprawnień admina.
 * Tylko sensei69 – admini nie mogą tworzyć kolejnych adminów.
 */
export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Zaloguj się." }, { status: 401 });
  if (!isSensei(user)) {
    return NextResponse.json(
      { error: "Tylko sensei69 może nadawać admina." },
      { status: 403 }
    );
  }

  const body = (await req.json().catch(() => null)) as
    | { username?: string; admin?: boolean }
    | null;

  const username = body?.username?.trim();
  const admin = body?.admin;
  if (!username || typeof admin !== "boolean") {
    return NextResponse.json({ error: "Nieprawidłowe dane." }, { status: 400 });
  }
  if (isSensei(username)) {
    return NextResponse.json(
      { error: "sensei69 ma uprawnienia admina na stałe." },
      { status: 400 }
    );
  }

  if (admin) {
    const ok = await grantAdmin(username, user);
    if (!ok) {
      return NextResponse.json(
        { error: "Nie ma takiego konta." },
        { status: 404 }
      );
    }
  } else {
    await revokeAdmin(username);
  }

  return NextResponse.json({
    ok: true,
    username,
    admin,
    admins: await listAdmins(),
  });
}

/** Lista adminów – tylko sensei69. */
export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Zaloguj się." }, { status: 401 });
  if (!isSensei(user)) {
    return NextResponse.json(
      { error: "Tylko sensei69 widzi listę adminów." },
      { status: 403 }
    );
  }
  return NextResponse.json({ admins: await listAdmins() });
}
