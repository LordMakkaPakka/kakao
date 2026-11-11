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

## 3. Gdzie trzymane są filmy

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

## 4. Diagnostyka zajętości bazy

```bash
DATABASE_URL="postgresql://..." node scripts/db-usage.mjs
```

Skrypt pokazuje rozmiar bazy, największe tabele i najcięższe filmy (czyli co
zwolnić, gdy baza się zapełnia).

## 5. Najczęstsze problemy

| Objaw | Przyczyna | Rozwiązanie |
|---|---|---|
| Biała strona / 500 na wszystkim | brak `DATABASE_URL` (albo inna nazwa zmiennej) | dodaj zmienną i zrób redeploy |
| „Baza danych przekroczyła limit” | quota hostingu bazy | usuń największe filmy lub podnieś plan |
| „Brak połączenia z bazą” | zły adres, baza uśpiona, brak SSL | sprawdź `/api/health`, dopisz `?sslmode=require` |
| Film się nie odtwarza (duży plik) | limit 4,5 MB odpowiedzi funkcji | włącz Vercel Blob (`BLOB_READ_WRITE_TOKEN`) |
| „Nieznany upload” przy wysyłaniu | stara wersja kodu (pamięć zamiast bazy) | wdróż aktualną wersję — uploady są w bazie |
