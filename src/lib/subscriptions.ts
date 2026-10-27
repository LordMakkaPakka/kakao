import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { subscriptions } from "@/db/schema";
import { ensureSchema } from "@/lib/dbInit";
import { users } from "@/db/schema";
import { isStaticVerified } from "@/lib/verified";

/**
 * Kanoniczna nazwa kanału (z zachowaniem wielkości liter z bazy) albo null,
 * gdy takiego kanału nie ma. Uwzględnia konta z listy startowej.
 */
export async function resolveChannel(channel: string): Promise<string | null> {
  const name = channel.trim();
  if (!name) return null;
  await ensureSchema();
  const [row] = await db
    .select({ username: users.username })
    .from(users)
    .where(sql`lower(${users.username}) = ${name.toLowerCase()}`)
    .limit(1);
  if (row) return row.username;
  return isStaticVerified(name) ? name : null;
}

/** Czy kanał o tej nazwie istnieje (konto w bazie albo lista startowa). */
export async function channelExists(channel: string): Promise<boolean> {
  return (await resolveChannel(channel)) !== null;
}

export type SubscribeState = {
  subscribed: boolean;
  subscribers: number;
};

/** Liczba subskrybentów kanału. */
export async function getSubscriberCount(channel: string): Promise<number> {
  await ensureSchema();
  const [row] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(subscriptions)
    .where(sql`lower(${subscriptions.channel}) = ${channel.trim().toLowerCase()}`);
  return row?.count ?? 0;
}

/** Czy `subscriber` subskrybuje kanał `channel`. */
export async function isSubscribed(
  subscriber: string | null | undefined,
  channel: string
): Promise<boolean> {
  if (!subscriber) return false;
  if (subscriber.trim().toLowerCase() === channel.trim().toLowerCase()) {
    return false;
  }
  await ensureSchema();
  const [row] = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(
      and(
        sql`lower(${subscriptions.subscriber}) = ${subscriber.trim().toLowerCase()}`,
        sql`lower(${subscriptions.channel}) = ${channel.trim().toLowerCase()}`
      )
    )
    .limit(1);
  return !!row;
}

/** Stan subskrypcji widziany oczami `viewer` (bez subskrybowania samego siebie). */
export async function getSubscribeState(
  channel: string,
  viewer: string | null | undefined
): Promise<SubscribeState> {
  const [subscribers, subscribed] = await Promise.all([
    getSubscriberCount(channel),
    isSubscribed(viewer, channel),
  ]);
  return { subscribed, subscribers };
}

/**
 * Przełączenie subskrypcji: subskrybuje, a jeśli już subskrybował – cofa.
 * Zwraca aktualny stan i liczbę subskrybentów.
 */
export async function toggleSubscription(
  subscriber: string,
  channel: string
): Promise<SubscribeState> {
  await ensureSchema();
  const me = subscriber.trim();
  const name = channel.trim();

  const [existing] = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(
      and(
        sql`lower(${subscriptions.subscriber}) = ${me.toLowerCase()}`,
        sql`lower(${subscriptions.channel}) = ${name.toLowerCase()}`
      )
    )
    .limit(1);

  if (existing) {
    await db.delete(subscriptions).where(eq(subscriptions.id, existing.id));
  } else {
    await db
      .insert(subscriptions)
      .values({ subscriber: me, channel: name })
      .onConflictDoNothing();
  }

  return {
    subscribed: !existing,
    subscribers: await getSubscriberCount(name),
  };
}

/** Odsubskrybowanie (używane przy sprzątaniu konta). */
export async function removeAllSubscriptions(username: string): Promise<void> {
  await ensureSchema();
  const lower = username.trim().toLowerCase();
  await db
    .delete(subscriptions)
    .where(sql`lower(${subscriptions.subscriber}) = ${lower}`);
  await db.delete(subscriptions).where(sql`lower(${subscriptions.channel}) = ${lower}`);
}

export type SubscribedChannel = {
  channel: string;
  subscribers: number;
  since: string;
};

/** Kanały, które subskrybuje dane konto (najnowsze pierwsze). */
export async function listMySubscriptions(
  subscriber: string
): Promise<SubscribedChannel[]> {
  await ensureSchema();
  const rows = await db
    .select({
      channel: subscriptions.channel,
      since: subscriptions.createdAt,
    })
    .from(subscriptions)
    .where(
      sql`lower(${subscriptions.subscriber}) = ${subscriber.trim().toLowerCase()}`
    )
    .orderBy(desc(subscriptions.createdAt))
    .limit(200);

  if (!rows.length) return [];

  const counts = await db
    .select({
      channel: sql<string>`lower(${subscriptions.channel})`,
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(subscriptions)
    .groupBy(sql`lower(${subscriptions.channel})`);
  const map = new Map(counts.map((c) => [c.channel, c.count]));

  return rows.map((r) => ({
    channel: r.channel,
    subscribers: map.get(r.channel.toLowerCase()) ?? 0,
    since: r.since.toISOString(),
  }));
}

export type SubscriberRow = { subscriber: string; since: string };

/** Kto subskrybuje dany kanał (do podglądu na profilu). */
export async function listSubscribers(
  channel: string,
  limit = 24
): Promise<SubscriberRow[]> {
  await ensureSchema();
  const rows = await db
    .select({ subscriber: subscriptions.subscriber, since: subscriptions.createdAt })
    .from(subscriptions)
    .where(sql`lower(${subscriptions.channel}) = ${channel.trim().toLowerCase()}`)
    .orderBy(desc(subscriptions.createdAt))
    .limit(limit);
  return rows.map((r) => ({ subscriber: r.subscriber, since: r.since.toISOString() }));
}
