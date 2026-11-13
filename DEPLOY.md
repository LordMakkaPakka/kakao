# Wdrożenie na Vercel

Krótka instrukcja: co ustawić, żeby strona działała po wdrożeniu, i co zrobić,
gdy coś nie działa.

## 1. Zmienne środowiskowe

W **Vercel → Project → Settings → Environment Variables** (dla Production
i Preview) muszą być ustawione:

| Zmienna | Wymagana | Do czego |
|---|---|---|
| `DATABASE_URL` **albo** `POSTGRES_URL` | tak | adres bazy Postgres (Neon, Supabase, RDS) |
| `BLOB_READ_WRITE_TOKEN` | opcjonalnie | magazyn plików Vercel Blob — wtedy filmy nie zajmują bazy |
| `TELEGRAM_BOT_TOKEN` | opcjonalnie | bramka dostępu: kod od bota Telegram (sekcja 4) |
| `POLHUB_TELEGRAM_GATE` | opcjonalnie | `off` wyłącza bramkę bez usuwania tokena |
| `CRON_SECRET` | opcjonalnie | chroni `/api/telegram/poll` (jeśli używasz crona) |

Aplikacja czyta adres bazy kolejno z: `DATABASE_URL`, `POSTGRES_URL`,
`POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING`, `NEON_DATABASE_URL`,
`DB_URL`. Integracja Neon + Vercel zwykle wstawia `POSTGRES_URL` — to działa.

Do zdalnych baz SSL jest włączany automatycznie, jeśli adres go nie zawiera.
Możesz też dopisać `?sslmode=require` ręcznie.

> Po każdej zmianie zmiennych zrób **Redeploy** — Vercel nie przeładowuje
> środowiska działającej instancji.

## 2. Sprawdzenie po wdrożeniu

Otwórz `https://<twoja-domena>/api/health`.

- `{ "ok": true, ... }` — baza działa, wszystko gra.
- `{ "ok": false, "kind": "quota" }` — baza przekroczyła limit hostingu
  (np. Neon). Zwolnij miejsce albo podnieś plan; kod nie jest winny.
- `{ "ok": false, "message": "Brak zmiennej z adresem bazy..." }` — nie
  ustawiono `DATABASE_URL`/`POSTGRES_URL` (albo zrobiłeś deploy bez redeployu).

## 3. Filmy: plik albo embed

Filmy można dodawać na dwa sposoby (zakładka na `/upload`):

| Sposób | Gdzie leży film | Intro | Uwagi |
|---|---|---|---|
| Wrzuć plik | u nas (baza lub Vercel Blob) | wklejone w odtwarzacz, przed filmem | do 200 MB, pełna kontrola |
| Wklej embed | na zewnętrznym serwisie | odtwarzacz PolHub gra intro, potem pokazuje embed | YouTube, Vimeo, Dailymotion, Streamable i inne |

Przy embedzie nie da się „wkleić” intra w cudzy plik — dlatego intro jest
osobnym etapem w naszym odtwarzaczu (z dźwiękiem i przyciskiem „Pomiń intro”).
Sam embed ma już własne przyciski serwisu źródłowego, więc nie wygląda
dokładnie jak player PolHub. Można wkleić adres filmu, adres do osadzenia
albo cały kod `<iframe>`.

## 3a. Gdzie trzymane są filmy

- **Domyślnie:** w bazie, kolumna `videos.data` (do 200 MB na plik).
  Zaleta: zero konfiguracji. Wady: zjada limit bazy i na Vercelu nie da się
  odtworzyć pliku większego niż 4,5 MB (limit odpowiedzi funkcji serverless).
- **Z `BLOB_READ_WRITE_TOKEN`:** plik trafia do Vercel Blob, a w bazie zostaje
  tylko adres. Odtwarzanie idzie bezpośrednio z CDN, więc duże filmy działają.
  Włącz magazyn: **Vercel → Storage → Blob → Create**, a potem dodaj
  `BLOB_READ_WRITE_TOKEN` do zmiennych i zrób redeploy.

Fragmenty wysyłanego pliku są tymczasowo trzymane w tabelach
`pending_uploads` i `upload_parts` (na Vercelu każdy request może trafić na
inną instancję, więc pamięć i `/tmp` nie wystarczą). Po zakończeniu uploadu
wpisy są usuwane, a porzucone — po 2 godzinach.

## 4. Dostęp przez bota Telegram (opcjonalnie)

Bramka włącza się sama, gdy ustawisz `TELEGRAM_BOT_TOKEN` (token od
[@BotFather](https://t.me/BotFather)). Wtedy **oglądanie i dodawanie filmów**
wymaga jednorazowego kodu:

1. Użytkownik klika „napisz do bota” i wysyła `/start`.
2. Bot odpowiada 6-znakowym kodem (ważny 15 minut, jednorazowy).
3. Kod wpisuje na stronie — konto zostaje odblokowane.

`sensei69` i admini są zawsze przepuszczani. `sensei69` może **odebrać dostęp**
w panelu (`/admin` → konto → „Odbierz dostęp TG”) — wtedy użytkownik musi
napisać do bota po nowy kod.

Jak to działa technicznie: strona nie potrzebuje webhooka. Ekran blokady sam
odpytuje `/api/telegram/poll` co kilka sekund (serwer ogranicza częstotliwość),
więc bot odpowiada od razu. Jeśli chcesz mieć to niezależnie od otwartej
strony, dodaj cron w `vercel.json`:

```json
{ "crons": [{ "path": "/api/telegram/poll", "schedule": "*/5 * * * *" }] }
```

(na planie Hobby Vercel pozwala na cron raz dziennie — wtedy zostaw samo
odpytywanie ze strony; na Pro/Minute działa powyższy zapis).

## 5. Czyszczenie serwisu (wszystkie konta i filmy)

Dwie drogi — obie usuwają **wszystkie** konta (także `sensei69`), filmy,
komentarze, subskrypcje, odznaki, bany, nadanych adminów i niedokończone
uploady. Strona i kod zostają.

**Z panelu (najprościej):** zaloguj się na `sensei69` → `/admin` → na dole
sekcji „Wyczyść cały serwis” → potwierdź. Po czyszczeniu zarejestruj
`sensei69` ponownie (uprawnienia ma z definicji, nie z bazy).

**Z terminala:**

```bash
DATABASE_URL="postgresql://..." pnpm wipe          # pokazuje, co zniknie
DATABASE_URL="postgresql://..." pnpm wipe --yes    # czyści
```

Czyszczenie odzyskuje też miejsce na dysku (`vacuum full`), więc po nim
zużycie limitu bazy wyraźnie spada. Jeśli filmy leżą w Vercel Blob, ustaw
`BLOB_READ_WRITE_TOKEN`, żeby skrypt usunął też pliki (panel robi to zawsze,
gdy token jest skonfigurowany).

## 6. Diagnostyka zajętości bazy

```bash
DATABASE_URL="postgresql://..." node scripts/db-usage.mjs
```

Skrypt pokazuje rozmiar bazy, największe tabele i najcięższe filmy (czyli co
zwolnić, gdy baza się zapełnia).

## 7. Najczęstsze problemy

| Objaw | Przyczyna | Rozwiązanie |
|---|---|---|
| Biała strona / 500 na wszystkim | brak `DATABASE_URL` (albo inna nazwa zmiennej) | dodaj zmienną i zrób redeploy |
| „Baza danych przekroczyła limit” | quota hostingu bazy | usuń największe filmy lub podnieś plan |
| „Brak połączenia z bazą” | zły adres, baza uśpiona, brak SSL | sprawdź `/api/health`, dopisz `?sslmode=require` |
| Film się nie odtwarza (duży plik) | limit 4,5 MB odpowiedzi funkcji | włącz Vercel Blob (`BLOB_READ_WRITE_TOKEN`) |
| „Nieznany upload” przy wysyłaniu | stara wersja kodu (pamięć zamiast bazy) | wdróż aktualną wersję — uploady są w bazie |
| „To konto już nie istnieje” | konto usunięte / serwis wyczyszczony, a stara sesja została w przeglądarce | wyloguj się i zaloguj ponownie |
| Bot nie odpowiada kodem | brak `TELEGRAM_BOT_TOKEN` albo token wygasł (BotFather → `/token`) | ustaw/odśwież token i zrób redeploy |
| „Kod wygasł / już wykorzystany” | kod jest jednorazowy i ważny 15 minut | napisz do bota `/start` ponownie |
| Embed się nie odtwarza | serwis źródłowy blokuje osadzanie albo ma własne zabezpieczenia | wklej adres `…/embed/…` albo wrzuć plik na PolHub |
