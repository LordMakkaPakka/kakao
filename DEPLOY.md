# Wdrożenie na Cloudflare Workers

PolHub działa jako **Cloudflare Worker** (Next.js przez adapter OpenNext).
Baza to Postgres (np. Neon) dostępny przez **Cloudflare Hyperdrive**, a filmy
są **wyłącznie embedami** — PolHub nie przyjmuje plików wideo.

## 0. Szybka ścieżka (3 kroki)

```bash
npx wrangler login                                   # 1. zaloguj CLI
npx wrangler hyperdrive create polhub-db \
  --connection-string="postgresql://..."             # 2. utwórz Hyperdrive
# 3. wklej wypisane id do wrangler.jsonc i sprawdź: pnpm cf:doctor
```

Potem albo `pnpm deploy` z terminala, albo podłączenie repozytorium do
Workers Builds (sekcja 1e). Konfigurację zawsze możesz sprawdzić bez
wdrażania:

```bash
pnpm cf:doctor
```

Skrypt mówi wprost, czego brakuje (placeholder `id` Hyperdrive, zła nazwa
bindingu, brak `nodejs_compat`, zła komenda builda).

## 1. Jednorazowa konfiguracja

### a) Zaloguj wrangler do Cloudflare

```bash
npx wrangler login
```

### b) Utwórz Hyperdrive dla swojej bazy

```bash
npx wrangler hyperdrive create polhub-db \
  --connection-string="postgresql://user:haslo@host/baza?sslmode=require"
```

Skąd wziąć connection string (Neon): panel projektu → **Connect** → zakładka
*Connection string* → wybierz „Pooled connection” i skopiuj adres (zawiera
`?sslmode=require`). Hasło z adresu musi być zakodowane, jeśli ma znaki
specjalne (`@` → `%40`, `#` → `%23`).

Polecenie wypisze blok JSON z `id`. Wklej je do `wrangler.jsonc` w miejsce
`WSTAW_ID_HYPERDRIVE`:

```jsonc
"hyperdrive": [{ "binding": "HYPERDRIVE", "id": "twoje-id" }]
```

> Hyperdrive trzyma pulę połączeń po swojej stronie, więc baza nie dostaje
> setek połączeń z każdej instancji Workera.

Przydatne komendy:

```bash
npx wrangler hyperdrive list                 # id wszystkich konfiguracji
npx wrangler hyperdrive get <id>             # szczegóły jednej
npx wrangler hyperdrive update <id> \
  --connection-string="postgresql://..."     # zmiana bazy (np. po resecie hasła)
npx wrangler hyperdrive delete <id>          # usunięcie
```

Ten sam efekt w panelu: **Cloudflare → Storage & Databases → Hyperdrive →
Create configuration** — tam też zobaczysz `id` („Configuration ID”) i
możesz podmienić connection string bez terminala.

### c) Sekrety (opcjonalne)

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN   # bramka kodem z Telegrama
npx wrangler secret put CRON_SECRET          # ochrona /api/telegram/poll
```

### d) Wdróż

```bash
pnpm deploy      # build + wdrożenie
pnpm preview     # lokalny podgląd w workerd (z bazą z Hyperdrive)
```

Pierwsze wdrożenie utworzy Workera `polhub` pod adresem
`https://polhub.<twoje-konto>.workers.dev`. Własną domenę dodasz w
**Workers & Pages → polhub → Settings → Domains & Routes**.

### e) Deployment z GitHuba (Workers Builds)

W panelu Cloudflare: **Workers & Pages → polhub → Settings → Build**.

| Pole | Wartość |
|---|---|
| Build command | `pnpm run build` |
| Deploy command | `npx wrangler deploy` |

`pnpm run build` robi teraz **build OpenNext** (a nie samo `next build`), więc
powstaje katalog `.open-next/`, którego wymaga deploy. Sam Next.js jest pod
`pnpm build:next` — OpenNext wywołuje go wewnętrznie (patrz
`open-next.config.ts`, pole `buildCommand`).

Częsty błąd: build ustawiony na `next build`, a deploy na `wrangler deploy` →
`ERROR Could not find compiled Open Next config, did you run the build command?`
Rozwiązanie: ustaw build command jak wyżej i kliknij **Retry deployment**.

Sekrety dodaj w **Settings → Variables and Secrets** (typ *Secret*), nie w
`wrangler.jsonc` — plik trafia do repozytorium.

## 2. Sprawdzenie po wdrożeniu

Otwórz `https://<twoja-domena>/api/health`.

- `{ "ok": true, "env": "HYPERDRIVE (Cloudflare)", ... }` — wszystko gra.
- `{ "ok": false, "kind": "quota" }` — baza przekroczyła limit hostingu.
- `"env": "brak (fallback lokalny)"` — brakuje bindingu `HYPERDRIVE`
  (albo stare wdrożenie po zmianie `wrangler.jsonc`).

## 3. Filmy: tylko embed

PolHub **nie przyjmuje plików wideo** — nie ma wgrywania, strumieniowania
ani magazynu plików. Film zawsze leży na serwisie źródłowym, a u nas jest
adres embeda i ramka odtwarzacza.

| Element | Jak to działa |
|---|---|
| Dodawanie | `/upload` → wklejasz adres filmu, adres do osadzenia albo cały `<iframe>` |
| Obsługiwane serwisy | YouTube, Vimeo, Dailymotion, Streamable i inne pozwalające na osadzanie |
| Intro | leci **przed** filmem, w tym samym oknie, z dźwiękiem i „Pomiń intro” |
| Ramka | górny pasek PolHub (logo, autor, tytuł, źródło), dolny pasek z przyciskami, znak PolHub w rogu obrazu (także w pełnym ekranie) |
| Baza | tylko `embed_url` — film nie zajmuje miejsca |

> Intro nie da się wkleić w cudzy plik, więc przy embedzie jest osobnym
> etapem naszego odtwarzacza. Sam embed zachowuje przyciski serwisu
> źródłowego — tego nie da się przestylizować.

### Stare filmy wgrane jako pliki

Po aktualizacji są ukryte (nie pojawiają się na listach, `/watch/<id>`
zwraca 404), ale nadal zajmują miejsce w bazie. Usuń je jednym z dwóch
sposobów:

- **panel:** `/admin` → „Stare filmy wgrane jako plik” → „Usuń stare pliki”,
- **terminal:**

```bash
DATABASE_URL="postgresql://..." pnpm purge-files        # pokazuje, co zniknie
DATABASE_URL="postgresql://..." pnpm purge-files --yes  # usuwa i odzyskuje miejsce
```

## 4. Dostęp przez bota Telegram (opcjonalnie)

Bramka włącza się sama, gdy ustawisz `TELEGRAM_BOT_TOKEN`
(sekret Workera, token od [@BotFather](https://t.me/BotFather)). Wtedy
**oglądanie i dodawanie filmów** wymaga jednorazowego kodu:

1. Użytkownik klika „napisz do bota” i wysyła `/start`.
2. Bot odpowiada 6-znakowym kodem (ważny 15 minut, jednorazowy).
3. Kod wpisuje na stronie — konto zostaje odblokowane.

Kolejność ustawiania bota:

1. Telegram → **@BotFather** → `/newbot` → nazwa → nazwa użytkownika kończąca
   się na `bot`. BotFather odpisze **tokenem** (format `123456:AAH…`).
2. W Cloudflare: **Settings → Variables and Secrets → Add** →
   *Secret* o nazwie `TELEGRAM_BOT_TOKEN`, wartość = token → **Deploy**.
   (Z terminala: `npx wrangler secret put TELEGRAM_BOT_TOKEN`.)
3. Wejdź na `/watch/<dowolny film>` lub `/upload` — pojawi się ekran
   „Odblokuj dostęp kodem z Telegrama” z linkiem do bota.
4. Wyślij botowi `/start` → dostaniesz 6-znakowy kod → wpisz go na stronie.

`sensei69` i admini są zawsze przepuszczani. `sensei69` może **odebrać dostęp**
w panelu (`/admin` → konto → „Odbierz dostęp TG”) — wtedy trzeba napisać do
bota po nowy kod.

Ekran blokady sam prosi serwer o odebranie wiadomości (co kilka sekund), więc
bot odpowiada od razu i **cron nie jest potrzebny**. Jeśli chcesz niezależności
od otwartej strony, ustaw zewnętrzny cron (np. cron-job.org) na
`POST https://<domena>/api/telegram/poll` z nagłówkiem
`Authorization: Bearer <CRON_SECRET>`.

## 5. Czyszczenie serwisu (wszystkie konta i filmy)

Dwie drogi — obie usuwają **wszystkie** konta (także `sensei69`), filmy,
komentarze, subskrypcje, odznaki, bany, nadanych adminów, dostępy Telegrama
i niedokończone uploady. Strona i kod zostają.

- **panel:** `sensei69` → `/admin` → na dole „Wyczyść cały serwis”,
- **terminal:**

```bash
DATABASE_URL="postgresql://..." pnpm wipe          # pokazuje, co zniknie
DATABASE_URL="postgresql://..." pnpm wipe --yes    # czyści
```

Czyszczenie odzyskuje miejsce (`vacuum full`), a liczniki `id` wracają do 1.
Po czyszczeniu zarejestruj `sensei69` ponownie — uprawnienia ma z definicji.

## 6. Diagnostyka zajętości bazy

```bash
DATABASE_URL="postgresql://..." node scripts/db-usage.mjs
```

Pokazuje rozmiar bazy, największe tabele i najcięższe filmy.

## 7. Praca lokalna

```bash
pnpm dev        # Next.js na Node (baza z DATABASE_URL)
pnpm preview    # workerd + bindingi z wrangler.jsonc
```

Do `pnpm dev` z bindingiem HYPERDRIVE ustaw lokalne połączenie:

```bash
CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE="postgresql://postgres:postgres@127.0.0.1:5432/postgres" pnpm dev
```

## 8. Najczęstsze problemy

| Objaw | Przyczyna | Rozwiązanie |
|---|---|---|
| Wszystkie strony 500, „Brak adresu bazy” | brak bindingu `HYPERDRIVE` | dodaj Hyperdrive w `wrangler.jsonc` i wdróż |
| `kind: "quota"` | limit hostingu bazy | usuń dane lub podnieś plan |
| „Cannot perform I/O on behalf of a different request” | współdzielone połączenie między żądaniami | nie twórz globalnej puli — kod robi to per żądanie |
| Bot nie odpowiada kodem | brak `TELEGRAM_BOT_TOKEN` albo zły token | `npx wrangler secret put TELEGRAM_BOT_TOKEN` |
| „Kod wygasł / już wykorzystany” | kod jest jednorazowy i ważny 15 min | napisz do bota `/start` ponownie |
| Embed się nie odtwarza | serwis źródłowy blokuje osadzanie | wklej adres `…/embed/…` albo link do filmu w innym serwisie |
| „To konto już nie istnieje” | konto usunięte / serwis wyczyszczony, stara sesja w przeglądarce | wyloguj się i zaloguj ponownie |
