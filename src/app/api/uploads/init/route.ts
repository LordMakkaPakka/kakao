import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { ensureSchema } from "@/lib/dbInit";
import { CHUNK_SIZE, createPendingUpload, MAX_UPLOAD_SIZE } from "@/lib/uploadStore";

export async function POST(req: NextRequest) {
  await ensureSchema();
  const user = getUserFromRequest(req);
  if (!user) {
    return NextResponse.json(
      { error: "Musisz się zalogować, aby wrzucać filmy." },
      { status: 401 }
    );
  }

  const body = (await req.json().catch(() => null)) as {
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
    title?: string;
    description?: string;
    category?: string;
    duration?: number;
    thumbnail?: string;
  } | null;

  if (!body) {
    return NextResponse.json({ error: "Nieprawidłowe dane." }, { status: 400 });
  }

  const title = body.title?.trim();
  const fileSize = Number(body.fileSize);

  if (!title) {
    return NextResponse.json({ error: "Podaj tytuł filmu." }, { status: 400 });
  }
  if (!Number.isFinite(fileSize) || fileSize <= 0) {
    return NextResponse.json({ error: "Wybierz plik wideo." }, { status: 400 });
  }
  if (fileSize > MAX_UPLOAD_SIZE) {
    return NextResponse.json(
      { error: "Maksymalny rozmiar pliku to 200 MB." },
      { status: 413 }
    );
  }

  const thumbnail =
    typeof body.thumbnail === "string" && body.thumbnail.startsWith("data:image/")
      ? body.thumbnail.slice(0, 400_000)
      : null;

  const upload = await createPendingUpload({
    user,
    fileSize,
    fileName: String(body.fileName ?? "film.mp4").slice(0, 200),
    mimeType: String(body.mimeType ?? "video/mp4").slice(0, 100) || "video/mp4",
    title: title.slice(0, 150),
    description: String(body.description ?? "").slice(0, 2000),
    category: String(body.category ?? "Amatorskie").slice(0, 40) || "Amatorskie",
    duration: Math.max(0, Math.round(Number(body.duration) || 0)),
    thumbnail,
  });

  return NextResponse.json({
    ok: true,
    uploadId: upload.id,
    chunkSize: CHUNK_SIZE,
  });
}