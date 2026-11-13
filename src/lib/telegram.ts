import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  telegramAccess,
  telegramCodes,
  telegramState,
} from "@/db/schema";
import { ensureSchema } from "@/lib/dbInit";
import { getAdminSet } from "@/lib/moderation";
import { isSensei } from "@/lib/verified";

/**
 * Dostęp do serwisu przez bota Telegram.
 *
 * Zasada działania:
 *  1. Użytkownik pisze do bota na Telegramie (np. `/start`).
 *  2. Bot odpowiada jednorazowym kodem (ważnym 15 minut).
 *  3. Kod wkleja się na PolHubie → konto zostaje odblokowane.
 *  4. sensei69 może dostęp odebrać — wtedy trzeba napisać do bota po nowy kod.
 *
 * Bramka działa tylko wtedy, gdy ustawiony jest `TELEGRAM_BOT_TOKEN`.
 * Konto sensei69 i admini są zawsze przepuszczani.
 */

const TOKEN = () => process.env.TELEGRAM_BOT_TOKEN?.trim() ?? "";
const CODE_TTL_MS = 15 * 60 * 1000;
const POLL_THROTTLE_MS = 2500;

/** Czy bramka Telegram jest w ogóle skonfigurowana? */
export function telegramConfigured(): boolean {
  return TOKEN().length > 0;
}

/** Czy trzeba odblokować konto kodem z Telegrama? (`POLHUB_TELEGRAM_GATE=off` wyłącza) */
export function gateEnabled(): boolean {
  return telegramConfigured() && process.env.POLHUB_TELEGRAM_GATE !== "off";
}

async function getState(key: string): Promise<string | null> {
  await ensureSchema();
  const [row] = await db
    .select({ value: telegramState.value })
    .from(telegramState)
    .where(eq(telegramState.key, key))
    .limit(1);
  return row?.value ?? null;
}

async function setState(key: string, value: string): Promise<void> {
  await ensureSchema();
  await db
    .insert(telegramState)
    .values({ key, value })
    .onConflictDoUpdate({ target: telegramState.key, set: { value } });
}

/** Wywołanie metody bota. Rzuca wyjątek z opisem błędu Telegramu. */
async function callBot<T>(method: string, payload?: Record<string, unknown>): Promise<T> {
  const token = TOKEN();
  if (!token) throw new Error("Brak TELEGRAM_BOT_TOKEN.");
  // Telegram potrafi nie odpowiadać (blokada sieci, awaria) — nie chcemy,
  // żeby strona czekała w nieskończoność na odpowiedź bota.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  let res: Response;
  try {
    res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload ? JSON.stringify(payload) : undefined,
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    result?: T;
    description?: string;
  };
  if (!res.ok || !data.ok) {
    throw new Error(data.description ?? `Telegram odpowiedział ${res.status}.`);
  }
  return data.result as T;
}

/** Nazwa bota (do pokazania linku „napisz na Telegramie”). */
export async function botUsername(): Promise<string | null> {
  if (!telegramConfigured()) return null;
  const cached = await getState("bot_username");
  if (cached) return cached;

  // Gdy Telegram nie odpowiada, nie ponawiamy przy każdym wejściu na stronę
  // (każda próba to kilka sekund). Próbujemy najwyżej raz na 2 minuty.
  const lastFail = Number((await getState("bot_username_fail")) ?? 0);
  if (Date.now() - lastFail < 120_000) return null;

  try {
    const me = await callBot<{ username?: string }>("getMe");
    if (me.username) {
      await setState("bot_username", me.username);
      return me.username;
    }
  } catch (err) {
    console.error("[polhub] nie udało się pobrać nazwy bota:", err);
    await setState("bot_username_fail", String(Date.now()));
  }
  return null;
}

/** Kod bez znaków, które mylą się przy przepisywaniu (0/O, 1/I). */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function newCode(): string {
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

type TelegramUpdate = {
  update_id: number;
  message?: {
    text?: string;
    chat?: { id?: number | string };
    from?: { username?: string; first_name?: string };
  };
};

/**
 * Odbiera zaległe wiadomości z Telegrama i odpowiada kodem.
 * Wywoływane przez cron (`/api/telegram/poll`) oraz przy próbie wpisania
 * kodu, żeby użytkownik nie musiał czekać na harmonogram.
 */
// Jedno odbieranie wiadomości naraz — ekran blokady odpytuje co kilka sekund,
// a nie chcemy kilku równoległych wywołań do Telegrama.
let pollInFlight: Promise<number> | null = null;

export async function pollBotUpdates(force = false): Promise<number> {
  if (!telegramConfigured()) return 0;
  if (pollInFlight) return pollInFlight;
  pollInFlight = doPoll(force).finally(() => {
    pollInFlight = null;
  });
  return pollInFlight;
}

async function doPoll(force: boolean): Promise<number> {
  await ensureSchema();

  if (!force) {
    const last = Number((await getState("last_poll")) ?? 0);
    if (Date.now() - last < POLL_THROTTLE_MS) return 0;
  }
  await setState("last_poll", String(Date.now()));

  const offset = Number((await getState("update_offset")) ?? 0) || undefined;
  let updates: TelegramUpdate[] = [];
  try {
    updates = await callBot<TelegramUpdate[]>("getUpdates", {
      offset,
      timeout: 0,
      allowed_updates: ["message"],
    });
  } catch (err) {
    console.error("[polhub] getUpdates nie powiodło się:", err);
    return 0;
  }

  let handled = 0;
  let maxId = offset ? offset - 1 : 0;

  for (const update of updates) {
    maxId = Math.max(maxId, update.update_id);
    const msg = update.message;
    const chatId = msg?.chat?.id;
    if (!chatId) continue;
    const text = (msg?.text ?? "").trim();
    if (!text) continue;

    // Reagujemy na /start (także z parametrem) i na samo „start”.
    const isStart = /^\/start\b/i.test(text) || /^start$/i.test(text);
    if (!isStart) {
      await callBot("sendMessage", {
        chat_id: chatId,
        text:
          "Aby dostać kod dostępu do PolHub, napisz /start. " +
          "Kod wpiszesz potem na stronie — w sekcji „Masz kod?”.",
      }).catch(() => {});
      continue;
    }

    // Nowe /start unieważnia poprzednie, niewykorzystane kody z tego czatu —
    // dzięki temu zawsze działa tylko najświeższy kod.
    await db
      .delete(telegramCodes)
      .where(and(eq(telegramCodes.chatId, String(chatId)), isNull(telegramCodes.usedAt)));

    const code = newCode();
    const expiresAt = new Date(Date.now() + CODE_TTL_MS);
    await db.insert(telegramCodes).values({
      code,
      chatId: String(chatId),
      telegramUsername: msg?.from?.username ?? null,
      expiresAt,
    });

    await callBot("sendMessage", {
      chat_id: chatId,
      parse_mode: "HTML",
      text:
        `Twój kod dostępu do <b>PolHub</b>:\n\n` +
        `<code>${code}</code>\n\n` +
        "Wpisz go na stronie (przycisk „Masz kod?”) w ciągu 15 minut. " +
        "Kod jest jednorazowy.",
    }).catch((err) => console.error("[polhub] sendMessage:", err));

    handled += 1;
  }

  if (updates.length > 0) {
    await setState("update_offset", String(maxId + 1));
  }
  return handled;
}

export type TelegramStatus = {
  /** Czy bramka jest włączona (bot skonfigurowany). */
  required: boolean;
  /** Czy to konto ma już odblokowany dostęp. */
  linked: boolean;
  /** Nazwa bota bez @ (do zbudowania linku t.me). */
  bot: string | null;
  /** Czy konto jest zwolnione z bramki (sensei69 / admin). */
  exempt: boolean;
  telegramUsername: string | null;
};

/** Stan dostępu dla danego konta. `null` = niezalogowany. */
export async function telegramStatus(username: string | null): Promise<TelegramStatus> {
  const required = gateEnabled();
  if (!username) {
    return {
      required,
      linked: false,
      bot: required ? await botUsername() : null,
      exempt: false,
      telegramUsername: null,
    };
  }

  const adminSet = await getAdminSet();
  const exempt = isSensei(username) || adminSet.has(username.trim().toLowerCase());
  const [row] = await db
    .select({ telegramUsername: telegramAccess.telegramUsername })
    .from(telegramAccess)
    .where(eq(telegramAccess.username, username))
    .limit(1);

  return {
    required,
    linked: !!row,
    bot: required ? await botUsername() : null,
    exempt,
    telegramUsername: row?.telegramUsername ?? null,
  };
}

/** Czy użytkownik może korzystać z filmów (oglądać i dodawać)? */
export async function hasSiteAccess(username: string | null): Promise<boolean> {
  if (!gateEnabled()) return true;
  if (!username) return false;
  const status = await telegramStatus(username);
  return status.exempt || status.linked;
}

export type RedeemResult =
  | { ok: true; telegramUsername: string | null }
  | { ok: false; error: string };

/** Sprawdza kod z Telegrama i odblokowuje konto. */
export async function redeemCode(username: string, rawCode: string): Promise<RedeemResult> {
  await ensureSchema();
  const code = rawCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (code.length !== 6) {
    return { ok: false, error: "Kod ma 6 znaków (litery i cyfry)." };
  }

  // Ktoś mógł dopiero co napisać do bota — odbierz wiadomość od razu.
  await pollBotUpdates();

  const [row] = await db
    .select()
    .from(telegramCodes)
    .where(eq(telegramCodes.code, code))
    .limit(1);

  if (!row) {
    return {
      ok: false,
      error:
        "Nie znam tego kodu. Napisz do bota na Telegramie /start i wpisz kod, którego Ci odpisał.",
    };
  }
  if (row.usedAt) {
    return { ok: false, error: "Ten kod został już wykorzystany. Napisz do bota po nowy." };
  }
  if (row.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: "Kod wygasł. Napisz do bota ponownie /start, dostaniesz nowy." };
  }

  await db
    .update(telegramCodes)
    .set({ usedAt: new Date(), username })
    .where(and(eq(telegramCodes.code, code), isNull(telegramCodes.usedAt)));

  await db
    .insert(telegramAccess)
    .values({
      username,
      chatId: row.chatId,
      telegramUsername: row.telegramUsername,
    })
    .onConflictDoUpdate({
      target: telegramAccess.username,
      set: {
        chatId: row.chatId,
        telegramUsername: row.telegramUsername,
        grantedAt: new Date(),
      },
    });

  return { ok: true, telegramUsername: row.telegramUsername };
}

/** Odebranie dostępu (sensei69). Konto musi znów zdobyć kod u bota. */
export async function revokeAccess(username: string): Promise<boolean> {
  await ensureSchema();
  const removed = await db
    .delete(telegramAccess)
    .where(sql`lower(${telegramAccess.username}) = ${username.trim().toLowerCase()}`)
    .returning({ username: telegramAccess.username });
  return removed.length > 0;
}

/** Lista kont z odblokowanym dostępem (panel moderacji). */
export async function listAccess(): Promise<
  { username: string; telegramUsername: string | null; grantedAt: string }[]
> {
  await ensureSchema();
  const rows = await db.select().from(telegramAccess);
  return rows.map((r) => ({
    username: r.username,
    telegramUsername: r.telegramUsername,
    grantedAt: r.grantedAt.toISOString(),
  }));
}
