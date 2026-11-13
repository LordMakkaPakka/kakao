import { NextRequest, NextResponse } from "next/server";
import { isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { videos } from "@/db/schema";
import { getUserFromRequest } from "@/lib/auth";
import { isSensei } from "@/lib/verified";
import { ensureSchema } from "@/lib/dbInit";

/**
 * Usuwa filmy wgrane jako plik (bez embeda).
 *
 * Wgrywanie plików zostało wyłączone — filmy trzymamy tylko jako embed.
 * Ten endpoint sprząta stare wpisy razem z danymi wideo, żeby odzyskać
 * miejsce w bazie. Tylko `sensei69`.
 */
export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Zaloguj się." }, { status: 401 });
  if (!isSensei(user)) {
    return NextResponse.json(
      { error: "Tylko sensei69 może usuwać stare pliki." },
      { status: 403 }
    );
  }

  await ensureSchema();

  const before = await db.execute<{ pretty: string }>(
    sql`select pg_size_pretty(pg_database_size(current_database())) as pretty`
  );

  const deleted = await db
    .delete(videos)
    .where(isNull(videos.embedUrl))
    .returning({ id: videos.id });

  // Po skasowaniu wierszy Postgres nie oddaje dysku — przepisujemy tabelę.
  try {
    await db.execute(sql`vacuum full videos`);
  } catch (err) {
    console.warn("[polhub] vacuum full videos nie powiodło się:", err);
  }

  const after = await db.execute<{ pretty: string }>(
    sql`select pg_size_pretty(pg_database_size(current_database())) as pretty`
  );

  return NextResponse.json({
    ok: true,
    deleted: deleted.length,
    sizeBeforeMb: before.rows[0]?.pretty ?? "?",
    sizeAfterMb: after.rows[0]?.pretty ?? "?",
  });
}
