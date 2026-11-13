import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * Konfiguracja adaptera OpenNext dla Cloudflare Workers.
 *
 * Bez dodatkowego cache (ISR nie jest używany — strony są `force-dynamic`,
 * bo pokazują dane z bazy). Gdybyś chciał cache'ować, dodaj tu
 * `incrementalCache: r2IncrementalCache` i bucket R2 w wrangler.jsonc.
 */
export default defineCloudflareConfig({});
