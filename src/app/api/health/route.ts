import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { classifyDbFailure, dbFailureMessage } from "@/lib/dbErrors";

export const dynamic = "force-dynamic";

/**
 * Szybka diagnostyka: czy aplikacja widzi bazę i czy ta nie odrzuca zapytań
 * (np. z powodu przekroczonego limitu). Nie zwraca żadnych danych ani haseł.
 */
export async function GET() {
  try {
    const rows = await db.execute(
      sql`select current_database() as database, pg_database_size(current_database()) as bytes`
    );
    const row = (rows as unknown as { rows?: Record<string, unknown>[] }).rows?.[0];
    const bytes = Number(row?.bytes ?? 0);

    return NextResponse.json({
      ok: true,
      database: String(row?.database ?? "?"),
      sizeBytes: bytes,
      sizeMb: Math.round((bytes / (1024 * 1024)) * 10) / 10,
    });
  } catch (err) {
    const kind = classifyDbFailure(err);
    return NextResponse.json(
      { ok: false, kind, message: dbFailureMessage(kind) },
      { status: 503 }
    );
  }
}
