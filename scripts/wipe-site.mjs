#!/usr/bin/env node
/**
 * Czyszczenie PolHub z terminala: usuwa wszystkie konta, filmy, komentarze
 * i dane pochodne (subskrypcje, odznaki, bany, adminów, niedokończone uploady).
 *
 * Użycie:
 *   DATABASE_URL=postgresql://... node scripts/wipe-site.mjs --yes
 *
 * Bez `--yes` skrypt tylko pokazuje, co by usunął — nic nie kasuje.
 * `sensei69` nie musi istnieć po czyszczeniu: zarejestruj je ponownie,
 * uprawnienia ma z definicji.
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
  console.error("Brak adresu bazy. Ustaw DATABASE_URL (albo POSTGRES_URL). Przykład:");
  console.error("  DATABASE_URL=postgresql://user:haslo@host/db node scripts/wipe-site.mjs --yes");
  process.exit(1);
}

const confirm = process.argv.includes("--yes");
const isLocal = /localhost|127\.0\.0\.1|\[::1\]/.test(url);
const connectionString =
  isLocal || /[?&]sslmode=/.test(url)
    ? url
    : `${url}${url.includes("?") ? "&" : "?"}sslmode=require`;

const TABLES = [
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

const client = new pg.Client({ connectionString });

try {
  await client.connect();

  const counts = {};
  for (const table of TABLES) {
    const res = await client.query(`select count(*)::int as n from ${table}`).catch(() => null);
    counts[table] = res ? res.rows[0].n : "brak tabeli";
  }

  const size = await client.query(
    "select pg_size_pretty(pg_database_size(current_database())) as pretty"
  );

  console.log(`Baza: ${size.rows[0].pretty}`);
  console.log("Do usunięcia:");
  for (const [table, n] of Object.entries(counts)) {
    console.log(`  ${table.padEnd(26)} ${n}`);
  }

  if (!confirm) {
    console.log("\nNic nie usunięto. Dodaj --yes, żeby wyczyścić serwis.");
    await client.end();
    process.exit(0);
  }

  for (const table of TABLES) {
    await client.query(`delete from ${table}`).catch((err) => {
      console.warn(`Pominięto ${table}: ${err.message}`);
    });
  }

  for (const table of ["users", "videos", "comments", "comment_votes", "subscriptions"]) {
    await client
      .query(`select setval(pg_get_serial_sequence('${table}', 'id'), 1, false)`)
      .catch((err) => console.warn(`Licznik ${table} bez resetu: ${err.message}`));
  }

  for (const table of ["videos", "upload_parts", "pending_uploads", "comments", "users"]) {
    await client
      .query(`vacuum full ${table}`)
      .catch((err) => console.warn(`Miejsca z ${table} nie udało się odzyskać: ${err.message}`));
  }

  const after = await client.query(
    "select pg_size_pretty(pg_database_size(current_database())) as pretty"
  );
  console.log(`\nGotowe. Baza: ${size.rows[0].pretty} → ${after.rows[0].pretty}`);
  console.log("Serwis jest pusty — zarejestruj sensei69, żeby wrócić do panelu.");
} catch (err) {
  console.error("Czyszczenie nie udało się:", err.message);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
