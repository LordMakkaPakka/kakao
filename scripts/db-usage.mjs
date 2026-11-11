#!/usr/bin/env node
/**
 * Diagnostyka zajętości bazy PolHub.
 *
 * Użycie (z DATABASE_URL w środowisku):
 *   DATABASE_URL=postgresql://... node scripts/db-usage.mjs
 *
 * Pokazuje rozmiar bazy, największe tabele i najcięższe filmy — czyli co
 * najczęściej zjada limit hostingu (np. Neon).
 */
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Brak DATABASE_URL. Przykład:");
  console.error("  DATABASE_URL=postgresql://user:haslo@host/db node scripts/db-usage.mjs");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });

const mb = (bytes) => `${(Number(bytes) / (1024 * 1024)).toFixed(2)} MB`;

try {
  await client.connect();

  const size = await client.query(
    "select pg_size_pretty(pg_database_size(current_database())) as pretty, pg_database_size(current_database()) as bytes"
  );
  console.log(`Baza: ${size.rows[0].pretty}\n`);

  const tables = await client.query(`
    select c.relname as name,
           c.reltuples::bigint as rows,
           pg_size_pretty(pg_total_relation_size(c.oid)) as size,
           pg_total_relation_size(c.oid) as bytes
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
    order by pg_total_relation_size(c.oid) desc
    limit 15
  `);
  console.log("Największe tabele:");
  for (const r of tables.rows) {
    console.log(`  ${r.name.padEnd(28)} ~${String(r.rows).padStart(7)} wierszy  ${r.size}`);
  }

  const hasVideos = await client.query(
    "select to_regclass('public.videos') is not null as ok"
  );
  if (hasVideos.rows[0].ok) {
    const vids = await client.query(`
      select id, title, uploader,
             pg_size_pretty(octet_length(data)::bigint) as size,
             octet_length(data) as bytes
      from videos
      order by octet_length(data) desc
      limit 10
    `);
    if (vids.rows.length) {
      console.log("\nNajcięższe filmy (dane trzymane w kolumnie videos.data):");
      for (const v of vids.rows) {
        console.log(`  #${v.id} ${v.size.padStart(9)}  ${v.uploader} — ${v.title}`);
      }
      const total = vids.rows.reduce((s, v) => s + Number(v.bytes), 0);
      console.log(`  (suma z 10 największych: ${mb(total)})`);
    } else {
      console.log("\nBrak filmów w bazie.");
    }
  }

  console.log("\nWskazówka: aby zwolnić miejsce, usuń największe filmy w panelu /admin → Filmy.");
} catch (err) {
  const msg = String(err?.message ?? err);
  if (err?.code === "53000" || /quota|exceeded/i.test(msg)) {
    console.error("Baza odrzuciła zapytanie: przekroczony limit hostingu (quota).");
    console.error("Podnieś plan w hostingu bazy albo zwolnij miejsce.");
  } else {
    console.error("Nie udało się połączyć z bazą:", msg);
  }
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
