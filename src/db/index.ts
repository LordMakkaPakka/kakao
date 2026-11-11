import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

/**
 * Połączenie z bazą.
 *
 * Na Vercelu (i w innych hostingach) zmienna z adresem bazy bywa nazwana
 * różnie — integracja Neon wstawia m.in. `POSTGRES_URL`, inne szablony
 * `DATABASE_URL` albo `POSTGRES_PRISMA_URL`. Sprawdzamy wszystkie znane
 * nazwy, żeby wdrożenie nie wywalało się tylko dlatego, że ktoś nazwał
 * zmienną inaczej.
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
  /** Nazwa zmiennej środowiskowej, z której pochodzi adres (do diagnostyki). */
  source: string;
  /** Czy adres pochodzi z prawdziwej konfiguracji hostingu. */
  configured: boolean;
};

/**
 * Wybiera adres bazy ze zmiennych środowiskowych.
 * Gdy nic nie ma (np. build bez env), zwraca lokalny adres zastępczy —
 * dzięki temu build się udaje, a użytkownik widzi czytelny komunikat
 * o braku bazy zamiast białej strony.
 */
export function resolveDatabaseConfig(): DatabaseConfig {
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

/** Czy host jest lokalny (wtedy nie wymuszamy SSL). */
function isLocalHost(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host === "0.0.0.0" ||
      host.endsWith(".local")
    );
  } catch {
    return false;
  }
}

/**
 * Zdalne bazy (Neon, Supabase, RDS) wymagają SSL. Jeśli adres go nie
 * deklaruje, dokładamy `sslmode=require`. Dzięki temu połączenie działa
 * także wtedy, gdy ktoś wkleił adres bez parametrów.
 */
function withSsl(url: string): string {
  if (isLocalHost(url)) return url;
  if (/[?&]sslmode=/.test(url)) return url;
  return `${url}${url.includes("?") ? "&" : "?"}sslmode=require`;
}

const config = resolveDatabaseConfig();

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

export const pool =
  globalForDb.__arenaNextJsPostgresqlPool ??
  new Pool({
    connectionString: withSsl(config.url),
    // Serverless (Vercel) tworzy wiele instancji — trzymamy małą pulę,
    // żeby nie wyczerpać limitu połączeń hostingu bazy.
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db = drizzle(pool);

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
    ssl: !!withSsl(config.url).match(/sslmode=/),
  };
}
