import { sql } from "drizzle-orm";
import { db } from "@/db";
import { ensureSchema } from "@/lib/dbInit";
import { deleteStoredVideo } from "@/lib/videoStorage";

/**
 * Czyszczenie serwisu: usuwa wszystkie filmy, komentarze, konta i wszystko,
 * co do nich należy (głosy, subskrypcje, odznaki, bany, nadania admina,
 * niedokończone uploady).
 *
 * Nie ruszamy niczego poza danymi, czyli: kodu, konfiguracji, sprzętu.
 * `sensei69` nie musi istnieć po czyszczeniu — to konto odzyskuje się
 * rejestracją (ma uprawnienia z definicji, nie z bazy).
 */
export type WipeSummary = {
  users: number;
  videos: number;
  comments: number;
  subscriptions: number;
  verifications: number;
  admins: number;
  uploads: number;
  /** Rozmiar bazy przed i po sprzątaniu. */
  sizeBeforeMb: string;
  sizeAfterMb: string;
  /** Ile arkuszy (tabel) wyczyszczono. */
  tables: number;
};

type CountRow = { count: number | string };

async function count(tables: string): Promise<number> {
  const res = await db.execute<CountRow>(sql.raw(`select count(*)::int as count from ${tables}`));
  const row = res.rows[0];
  return row ? Number(row.count) : 0;
}

async function databaseSize(): Promise<string> {
  const res = await db.execute<{ pretty: string }>(
    sql`select pg_size_pretty(pg_database_size(current_database())) as pretty`
  );
  return res.rows[0]?.pretty ?? "?";
}

/** Adresy filmów w magazynie zewnętrznym — trzeba je usunąć osobno. */
async function externalVideoUrls(): Promise<string[]> {
  const res = await db.execute<{ file_url: string | null }>(
    sql`select file_url from videos where file_url is not null`
  );
  return res.rows.map((r) => r.file_url).filter((url): url is string => !!url);
}

/**
 * Czyści cały serwis. Kolejność ma znaczenie tylko dla czytelności —
 * klucze obce mają `on delete cascade`, ale i tak czyścimy wszystko jawnie.
 */
export async function wipeSite(): Promise<WipeSummary> {
  await ensureSchema();

  const sizeBeforeMb = await databaseSize();

  const urls = await externalVideoUrls();
  const videos = await count("videos");
  const comments = await count("comments");
  const users = await count("users");
  const subscriptions = await count("subscriptions");
  const verifications = await count("verifications");
  const admins = await count("admins");
  const uploads = await count("pending_uploads");

  // Magazyn plików (Vercel Blob) sprzątamy przed usunięciem wierszy,
  // bo po nich nie byłoby już skąd wziąć adresów.
  for (const url of urls) {
    await deleteStoredVideo(url);
  }

  const tables = [
    "comment_votes",
    "comments",
    "videos",
    "upload_parts",
    "pending_uploads",
    "subscriptions",
    "verification_revocations",
    "verifications",
    "admins",
    "telegram_access",
    "telegram_codes",
    "users",
  ];

  for (const table of tables) {
    await db.execute(sql.raw(`delete from ${table}`));
  }

  // Liczniki wracają do zera, żeby pierwsze konto i pierwszy film dostały
  // znów numery od 1 (czyste, przewidywalne adresy). To kosmetyka — gdy baza
  // nie pozwoli, dane i tak są już usunięte, więc nie przerywamy sprzątania.
  const idTables = ["users", "videos", "comments", "comment_votes", "subscriptions"];
  for (const table of idTables) {
    try {
      await db.execute(
        sql.raw(
          `select setval(pg_get_serial_sequence('${table}', 'id'), 1, false)`
        )
      );
    } catch (err) {
      console.warn(`[polhub] nie udało się zresetować licznika ${table}:`, err);
    }
  }

  // Skasowane wiersze w Postgresie zostają na dysku, dopóki tabela nie
  // zostanie przepisana. Bez tego limit miejsca na hostingu bazy (np. Neon)
  // dalej byłby zajęty mimo pustej strony.
  for (const table of ["videos", "upload_parts", "pending_uploads", "comments", "users"]) {
    try {
      await db.execute(sql.raw(`vacuum full ${table}`));
    } catch (err) {
      console.warn(`[polhub] nie udało się odzyskać miejsca z ${table}:`, err);
    }
  }

  const sizeAfterMb = await databaseSize();

  return {
    users,
    videos,
    comments,
    subscriptions,
    verifications,
    admins,
    uploads,
    sizeBeforeMb,
    sizeAfterMb,
    tables: tables.length,
  };
}
