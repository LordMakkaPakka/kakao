#!/usr/bin/env node
/**
 * Sprawdza konfigurację wdrożenia na Cloudflare, zanim klikniesz „Deploy”.
 *
 *   pnpm cf:doctor
 *
 * Pokazuje, czy `wrangler.jsonc` ma prawdziwe id Hyperdrive, czy bindingi są
 * nazwane tak, jak oczekuje kod, i co jeszcze warto ustawić w panelu.
 */
import { existsSync, readFileSync } from "node:fs";

const ok = (msg) => console.log(`  ✓ ${msg}`);
const warn = (msg) => console.log(`  ! ${msg}`);
const bad = (msg) => console.log(`  ✗ ${msg}`);

let problems = 0;

function readJsonc(path) {
  const raw = readFileSync(path, "utf8");
  // Usuwamy komentarze // i /* */, żeby dało się sparsować JSON-a.
  const stripped = raw
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
  return JSON.parse(stripped);
}

console.log("\nPolHub — kontrola konfiguracji Cloudflare\n");

/* 1. Pliki konfiguracyjne */
console.log("Pliki:");
for (const file of ["wrangler.jsonc", "open-next.config.ts", "next.config.ts"]) {
  if (existsSync(file)) ok(file);
  else {
    bad(`brak ${file}`);
    problems += 1;
  }
}

/* 2. wrangler.jsonc: Hyperdrive */
console.log("\nHyperdrive (baza):");
let config = null;
try {
  config = readJsonc("wrangler.jsonc");
} catch (err) {
  bad(`nie mogę odczytać wrangler.jsonc: ${err.message}`);
  problems += 1;
}

const hyperdrive = config?.hyperdrive?.[0];
if (!hyperdrive) {
  bad("brak wpisu \"hyperdrive\" w wrangler.jsonc");
  problems += 1;
} else if (!hyperdrive.id || /WSTAW|PLACEHOLDER|TODO/i.test(hyperdrive.id)) {
  bad(`id Hyperdrive to wciąż placeholder: ${hyperdrive.id ?? "(brak)"}`);
  console.log("    Utwórz konfigurację i wklej jej id:");
  console.log("      npx wrangler hyperdrive create polhub-db \\");
  console.log('        --connection-string="postgresql://user:haslo@host/baza?sslmode=require"');
  problems += 1;
} else {
  ok(`binding ${hyperdrive.binding} → id ${hyperdrive.id}`);
  if (hyperdrive.binding !== "HYPERDRIVE") {
    warn("kod czyta binding o nazwie HYPERDRIVE — inna nazwa nie zadziała");
    problems += 1;
  }
}

/* 3. Worker + assety */
console.log("\nWorker:");
if (config?.main === ".open-next/worker.js") ok("main = .open-next/worker.js");
else {
  bad(`main = ${config?.main ?? "(brak)"} — powinno być .open-next/worker.js`);
  problems += 1;
}
if (config?.assets?.directory === ".open-next/assets") ok("assety z .open-next/assets");
else {
  warn("brak wpisu assets.directory = .open-next/assets");
  problems += 1;
}
if (Array.isArray(config?.compatibility_flags) && config.compatibility_flags.includes("nodejs_compat")) {
  ok("flaga nodejs_compat");
} else {
  bad("brak flagi nodejs_compat (pg i krypto potrzebują jej)");
  problems += 1;
}

/* 4. Build */
console.log("\nBuild:");
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
if (String(pkg.scripts?.build ?? "").includes("opennextjs-cloudflare")) {
  ok("`pnpm build` robi build OpenNext (zgodne z domyślną komendą Workers Builds)");
} else {
  warn(`\`pnpm build\` = "${pkg.scripts?.build}" — Workers Builds zrobi go zamiast OpenNext`);
  console.log("    Ustaw w panelu Build command: npx opennextjs-cloudflare build");
  problems += 1;
}
if (String(pkg.scripts?.["build:next"] ?? "").includes("next build")) {
  ok("`pnpm build:next` = next build (używane wewnątrz OpenNext)");
}

/* 5. Podsumowanie */
console.log("\nCo jeszcze ustawić poza repo:");
console.log("  • Workers Builds → Build command:  pnpm run build");
console.log("  • Workers Builds → Deploy command: npx wrangler deploy");
console.log("  • Secrets: TELEGRAM_BOT_TOKEN (bramka), opcjonalnie CRON_SECRET");
console.log("  • Po wdrożeniu sprawdź /api/health — ma być env: HYPERDRIVE (Cloudflare)");

console.log(
  problems === 0
    ? "\nWszystko wygląda dobrze — możesz wdrażać.\n"
    : `\nDo poprawy: ${problems} rzecz(y). Szczegóły wyżej.\n`
);

process.exitCode = problems === 0 ? 0 : 1;
