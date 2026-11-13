import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// W trybie `next dev` daje dostęp do bindingów z wrangler.jsonc (m.in.
// HYPERDRIVE), więc baza działa lokalnie tak samo jak na Cloudflare.
// Przy `next build` pomijamy — wtedy nie ma jeszcze środowiska Workera,
// a binding Hyperdrive próbowałby się rozwiązać i wysypałby build.
if (process.env.NODE_ENV === "development") {
  initOpenNextCloudflareForDev();
}

const nextConfig: NextConfig = {
  // Serwer produkcyjny to Worker (Cloudflare) — obrazy obsługuje przeglądarka,
  // a kompresję i cache robi Cloudflare.
  poweredByHeader: false,
};

export default nextConfig;
