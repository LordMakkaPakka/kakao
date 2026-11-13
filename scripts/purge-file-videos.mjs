#!/usr/bin/env node
/**
 * Usuwa filmy wgrane jako plik (bez embeda) — wgrywanie plików zostało
 * wyłączone, a stare wpisy zajmują miejsce w bazie.
 *
 * Użycie:
 *   DATABASE_URL=postgresql://... node scripts/purge-file-videos.mjs        # tylko pokazuje
 *   DATABASE_URL=postgresql://... node scripts/purge-file-videos.mjs --yes  # usuwa
 */
import pg from "pg";

const URL_ENV_NAMES = [
  "DATABASE_URL",
  "POSTGRES_URL",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL_NON_POOLING",
  "NEON_DATABASE_URL",
  "DB_URL",
];

const url = URL_ENV_NAMES.map((n) => process.env[n]).find((v) => v && v.trim());
if (!url) {
  console.error("Brak adresu bazy. Ustaw DATABASE_URL (albo POSTGRES_URL).");
  process.exit(1);
}

const confirm = process.argv.includes("--yes");
const isLocal = /localhost|127\.0\.0\.1|\[::1\]/.test(url);
const connectionString =
  isLocal || /[?&]sslmode=/.test(url)
    ? url
    : `${url}${url.includes("?") ? "&" : "?"}sslmode=require`;

const client = new pg.Client({ connectionString });

try {
  await client.connect();

  const { rows } = await client.query(`
    select count(*)::int as count,
           coalesce(sum(pg_column_size(data)), 0)::bigint as bytes
    from videos
    where embed_url is null
  `);
  const count = rows[0].count;
  const mb = (Number(rows[0].bytes) / (1024 * 1024)).toFixed(1);

  const size = await client.query(
    "select pg_size_pretty(pg_database_size(current_database())) as pretty"
  );
  console.log(`Baza: ${size.rows[0].pretty}`);
  console.log(`Filmy wgrane jako plik: ${count} (dane wideo ~${mb} MB)`);

  if (count === 0) {
    console.log("Nie ma czego usuwać.");
  } else if (!confirm) {
    console.log("Nic nie usunięto. Dodaj --yes, żeby skasować te filmy.");
  } else {
    const deleted = await client.query(
      "delete from videos where embed_url is null returning id"
    );
    console.log(`Usunięto ${deleted.rowCount} film(ów).`);

    // Postgres nie oddaje dysku po skasowaniu wierszy — przepisujemy tabelę.
    await client
      .query("vacuum full videos")
      .catch((err) => console.warn(`Nie udało się odzyskać miejsca: ${err.message}`));

    const after = await client.query(
      "select pg_size_pretty(pg_database_size(current_database())) as pretty"
    );
    console.log(`Baza: ${size.rows[0].pretty} → ${after.rows[0].pretty}`);
  }
} catch (err) {
  console.error("Sprzątanie nie udało się:", err.message);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
