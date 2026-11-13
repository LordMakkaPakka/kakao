import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * Konfiguracja adaptera OpenNext dla Cloudflare Workers.
 *
 * `buildCommand` wskazuje `pnpm build:next` (samo `next build`), bo domyślny
 * skrypt `pnpm build` to właśnie build OpenNext — bez tego adapter wywołałby
 * sam siebie i build kręciłby się w kółko.
 *
 * Bez dodatkowego cache (ISR nie jest używany — strony są `force-dynamic`,
 * bo pokazują dane z bazy). Gdybyś chciał cache'ować, dodaj tu
 * `incrementalCache: r2IncrementalCache` i bucket R2 w wrangler.jsonc.
 */
const config = {
  ...defineCloudflareConfig({}),
  // OpenNext uruchamia ten skrypt zamiast `pnpm build` (który sam jest
  // buildem OpenNext) — inaczej build wywołałby sam siebie.
  buildCommand: "pnpm build:next",
};

export default config;
