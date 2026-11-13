import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Połączenie z bazą.
 *
 * Podstawowa droga na Cloudflare to binding `HYPERDRIVE` — daje gotowy
 * connection string, a samo Hyperdrive trzyma pulę połączeń po swojej stronie.
 * Gdy bindingu nie ma (np. zwykły `next start` albo lokalny development),
 * bierzemy adres ze znanych zmiennych środowiskowych.
 */
const URL_ENV_NAMES = [
  "DATABASE_URL",
  "POSTGRES_URL",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL_NON_POOLING",
  "NEON_DATABASE_URL",
  "DB_URL",
] as const;

export type DatabaseConfig = {
  /** Adres użyty do połączenia (może być awaryjny, lokalny). */
  url: string;
  /** Skąd pochodzi adres (do diagnostyki). */
  source: string;
  /** Czy adres pochodzi z prawdziwej konfiguracji hostingu. */
  configured: boolean;
};

type CloudflareCtx = {
  env?: { HYPERDRIVE?: { connectionString?: string } };
  ctx?: object;
};

/**
 * Kontekst Cloudflare (bindingi + obiekt żądania).
 *
 * W Workers każde żądanie ma własny kontekst i własne I/O — nie wolno
 * współdzielić połączenia między żądaniami (runtime zgłasza wtedy
 * „Cannot perform I/O on behalf of a different request”). Dlatego pulę
 * trzymamy osobno dla każdego kontekstu, a nie globalnie.
 */
function cloudflareCtx(): CloudflareCtx | null {
  // Podczas `next build` nie ma środowiska Workera, a binding Hyperdrive
  // próbowałby się rozwiązać i wysypałby build.
  if (process.env.NEXT_PHASE === "phase-production-build") return null;
  try {
    return getCloudflareContext() as unknown as CloudflareCtx;
  } catch {
    return null;
  }
}

/** Wybiera adres bazy: najpierw Hyperdrive, potem zmienne środowiskowe. */
export function resolveDatabaseConfig(cf: CloudflareCtx | null = cloudflareCtx()): DatabaseConfig {
  const hyperdrive = cf?.env?.HYPERDRIVE?.connectionString?.trim();
  if (hyperdrive) {
    return { url: hyperdrive, source: "HYPERDRIVE (Cloudflare)", configured: true };
  }

  for (const name of URL_ENV_NAMES) {
    const value = process.env[name];
    if (value && value.trim()) {
      return { url: value.trim(), source: name, configured: true };
    }
  }

  return {
    url: "postgresql://postgres:postgres@127.0.0.1:5432/postgres",
    source: "brak (fallback lokalny)",
    configured: false,
  };
}

const config = resolveDatabaseConfig();

/** Czy host jest lokalny (wtedy nie wymuszamy SSL). */
function isLocalHost(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host === "0.0.0.0" ||
      host.endsWith(".local") ||
      host.endsWith(".hyperdrive.local")
    );
  } catch {
    return false;
  }
}

/**
 * Zdalne bazy (Neon, Supabase, RDS) wymagają SSL. Jeśli adres go nie
 * deklaruje, dokładamy `sslmode=require`.
 */
function withSsl(url: string): string {
  if (isLocalHost(url)) return url;
  if (/[?&]sslmode=/.test(url)) return url;
  return `${url}${url.includes("?") ? "&" : "?"}sslmode=require`;
}

const globalForDb = globalThis as typeof globalThis & {
  __polhubPools?: WeakMap<object, Pool>;
  __polhubDbs?: WeakMap<Pool, NodePgDatabase>;
  __polhubNodePool?: Pool;
  __polhubNodeDb?: NodePgDatabase;
};

function newPool(connectionString: string): Pool {
  return new Pool({
    connectionString: withSsl(connectionString),
    // Pula per żądanie: kilka połączeń wystarczy (Hyperdrive i tak pooluje).
    max: 3,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 10_000,
  });
}

/** Pula dla bieżącego żądania (albo wspólna, gdy nie ma kontekstu CF). */
function currentPool(): Pool {
  const cf = cloudflareCtx();
  if (!cf?.ctx) {
    if (!globalForDb.__polhubNodePool) {
      globalForDb.__polhubNodePool = newPool(config.url);
    }
    return globalForDb.__polhubNodePool;
  }

  if (!globalForDb.__polhubPools) globalForDb.__polhubPools = new WeakMap();
  const pools = globalForDb.__polhubPools;
  let pool = pools.get(cf.ctx);
  if (!pool) {
    pool = newPool(cf.env?.HYPERDRIVE?.connectionString ?? config.url);
    pools.set(cf.ctx, pool);
  }
  return pool;
}

/** Klient Drizzle dla bieżącej puli (tworzony raz na żądanie). */
function currentDb(): NodePgDatabase {
  const pool = currentPool();
  if (!globalForDb.__polhubDbs) globalForDb.__polhubDbs = new WeakMap();
  const dbs = globalForDb.__polhubDbs;
  let instance = dbs.get(pool);
  if (!instance) {
    instance = drizzle(pool);
    dbs.set(pool, instance);
  }
  return instance;
}

/**
 * Wspólny obiekt bazy dla całej aplikacji.
 *
 * Pod spodem zawsze trafia do puli właściwej dla bieżącego żądania, więc
 * kod może dalej używać `db.select(...)`, `db.execute(...)` itd.
 */
export const db: NodePgDatabase = new Proxy({} as NodePgDatabase, {
  get(_target, prop, receiver) {
    const instance = currentDb();
    const value = Reflect.get(instance, prop, receiver);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

/** Informacje do diagnostyki (/api/health) — bez haseł. */
export function databaseInfo() {
  let host = "?";
  let database = "?";
  try {
    const parsed = new URL(config.url);
    host = parsed.hostname;
    database = parsed.pathname.replace(/^\//, "") || "?";
  } catch {
    /* zostawiamy "?" */
  }
  return {
    configured: config.configured,
    source: config.source,
    host,
    database,
    ssl: /sslmode=/.test(withSsl(config.url)),
  };
}
