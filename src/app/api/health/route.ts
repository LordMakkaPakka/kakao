import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { databaseInfo, db } from "@/db";
import { classifyDbFailure, dbFailureMessage } from "@/lib/dbErrors";

export const dynamic = "force-dynamic";

/**
 * Diagnostyka wdrożenia: czy aplikacja widzi bazę, skąd bierze adres
 * i czy baza nie odrzuca zapytań (np. przekroczony limit).
 * Nie zwraca haseł ani pełnego adresu — tylko host i nazwę bazy.
 */
export async function GET() {
  const info = databaseInfo();

  if (!info.configured) {
    return NextResponse.json(
      {
        ok: false,
        kind: "connection",
        env: info.source,
        host: info.host,
        ssl: info.ssl,
        message:
          "Brak adresu bazy. Na Cloudflare dodaj binding HYPERDRIVE w wrangler.jsonc " +
          "(albo sekret DATABASE_URL) i wdróż ponownie.",
      },
      { status: 503 }
    );
  }

  try {
    const rows = await db.execute(
      sql`select current_database() as database, pg_database_size(current_database()) as bytes`
    );
    const row = (rows as unknown as { rows?: Record<string, unknown>[] }).rows?.[0];
    const bytes = Number(row?.bytes ?? 0);

    return NextResponse.json({
      ok: true,
      env: info.source,
      host: info.host,
      ssl: info.ssl,
      database: String(row?.database ?? info.database),
      sizeBytes: bytes,
      sizeMb: Math.round((bytes / (1024 * 1024)) * 10) / 10,
    });
  } catch (err) {
    const kind = classifyDbFailure(err);
    return NextResponse.json(
      {
        ok: false,
        kind,
        env: info.source,
        host: info.host,
        ssl: info.ssl,
        database: info.database,
        message: info.configured
          ? dbFailureMessage(kind)
          : "Brak adresu bazy. Na Cloudflare dodaj binding HYPERDRIVE w wrangler.jsonc (albo sekret DATABASE_URL) i wdróż ponownie.",
      },
      { status: 503 }
    );
  }
}
