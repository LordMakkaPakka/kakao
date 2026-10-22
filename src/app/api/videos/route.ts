import { NextRequest, NextResponse } from "next/server";
import { desc, ilike } from "drizzle-orm";
import { db } from "@/db";
import { videos } from "@/db/schema";
import { getUserFromRequest } from "@/lib/auth";
import { ensureSchema } from "@/lib/dbInit";

const MAX_SIZE = 100 * 1024 * 1024; // 100 MB

export async function GET(req: NextRequest) {
  await ensureSchema();
  const q = req.nextUrl.searchParams.get("q")?.trim();
  const rows = await db
    .select({
      id: videos.id,
      title: videos.title,
      category: videos.category,
      uploader: videos.uploader,
      durationSeconds: videos.durationSeconds,
      thumbnail: videos.thumbnail,
      views: videos.views,
      likes: videos.likes,
      dislikes: videos.dislikes,
      createdAt: videos.createdAt,
    })
    .from(videos)
    .where(q ? ilike(videos.title, `%${q}%`) : undefined)
    .orderBy(desc(videos.createdAt))
    .limit(60);

  return NextResponse.json({ videos: rows });
}

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) {
    return NextResponse.json(
      { error: "Musisz się zalogować, aby wrzucać filmy." },
      { status: 401 }
    );
  }
  await ensureSchema();

  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "Nieprawidłowe dane." }, { status: 400 });
  }

  const file = form.get("file");
  const title = String(form.get("title") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const category = String(form.get("category") ?? "Amatorskie").trim();
  const duration = Math.round(Number(form.get("duration") ?? 0)) || 0;
  const thumbnailRaw = form.get("thumbnail");
  const thumbnail =
    typeof thumbnailRaw === "string" && thumbnailRaw.startsWith("data:image/")
      ? thumbnailRaw.slice(0, 400_000)
      : null;

  if (!title) {
    return NextResponse.json({ error: "Podaj tytuł filmu." }, { status: 400 });
  }
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Wybierz plik wideo." }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "Maksymalny rozmiar pliku to 100 MB." },
      { status: 413 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const [row] = await db
    .insert(videos)
    .values({
      title: title.slice(0, 150),
      description: description.slice(0, 2000),
      category: category.slice(0, 40) || "Amatorskie",
      uploader: user,
      fileName: file.name.slice(0, 200),
      mimeType: file.type || "video/mp4",
      fileSize: file.size,
      durationSeconds: duration,
      thumbnail,
      data: buffer,
    })
    .returning({ id: videos.id });

  return NextResponse.json({ ok: true, id: row.id });
}