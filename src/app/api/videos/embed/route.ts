import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { videos } from "@/db/schema";
import { getUserFromRequest } from "@/lib/auth";
import { bannedResponse } from "@/lib/moderation";
import { ensureSchema } from "@/lib/dbInit";
import { normalizeEmbed } from "@/lib/embed";
import { hasSiteAccess } from "@/lib/telegram";
import { CATEGORIES } from "@/lib/format";

/**
 * Dodanie filmu przez embed — film leży na zewnętrznym serwisie, u nas
 * zostaje tylko adres. Intro PolHub leci przed embedem (odtwarzacz strony),
 * a nie jest wklejone w sam plik.
 */
export async function POST(req: NextRequest) {
  await ensureSchema();
  const user = getUserFromRequest(req);
  if (!user) {
    return NextResponse.json(
      { error: "Musisz się zalogować, aby dodawać filmy." },
      { status: 401 }
    );
  }

  const blocked = await bannedResponse(user);
  if (blocked) return blocked;

  if (!(await hasSiteAccess(user))) {
    return NextResponse.json(
      { error: "Najpierw odblokuj dostęp kodem z Telegrama." },
      { status: 403 }
    );
  }

  const body = (await req.json().catch(() => null)) as {
    embedUrl?: string;
    title?: string;
    description?: string;
    category?: string;
    duration?: number;
  } | null;
  if (!body) {
    return NextResponse.json({ error: "Nieprawidłowe dane." }, { status: 400 });
  }

  const title = (body.title ?? "").trim().slice(0, 150);
  if (!title) {
    return NextResponse.json({ error: "Podaj tytuł filmu." }, { status: 400 });
  }

  const embed = normalizeEmbed(body.embedUrl ?? "");
  if (!embed.ok) {
    return NextResponse.json({ error: embed.error }, { status: 400 });
  }

  const allowed: string[] = CATEGORIES.filter(
    (c) => c !== "Wszystkie" && c !== "Popularne"
  );
  const requested = (body.category ?? "").trim();
  const category = allowed.includes(requested) ? requested : allowed[0] ?? "Amatorskie";

  const description = (body.description ?? "").trim().slice(0, 2000);
  const duration = Math.max(0, Math.min(24 * 3600, Math.round(Number(body.duration) || 0)));

  const [row] = await db
    .insert(videos)
    .values({
      title,
      description,
      category,
      uploader: user,
      fileName: `${embed.provider.toLowerCase().replace(/\s+/g, "-")}-embed`,
      mimeType: "text/html",
      fileSize: 0,
      durationSeconds: duration,
      thumbnail: embed.thumbnail,
      embedUrl: embed.url,
      // Kolumna `data` jest wymagana — embed nie ma pliku u nas.
      data: Buffer.alloc(0),
    })
    .returning({ id: videos.id });

  return NextResponse.json({
    ok: true,
    id: row.id,
    embedUrl: embed.url,
    provider: embed.provider,
  });
}
