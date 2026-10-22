import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { videos } from "@/db/schema";
import { getUserFromRequest } from "@/lib/auth";
import { ensureSchema } from "@/lib/dbInit";
import { finalizeUpload, pendingUploads } from "@/lib/uploadStore";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  await ensureSchema();
  const user = getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Brak sesji." }, { status: 401 });
  }

  const { id } = await ctx.params;
  const upload = pendingUploads.get(id);
  if (!upload || upload.user !== user) {
    return NextResponse.json(
      { error: "Nieznany upload. Zacznij przesyłanie od nowa." },
      { status: 404 }
    );
  }

  if (upload.received !== upload.fileSize) {
    return NextResponse.json(
      {
        error: `Niepełny plik: odebrano ${upload.received} z ${upload.fileSize} bajtów.`,
        received: upload.received,
      },
      { status: 409 }
    );
  }

  const buffer = await finalizeUpload(upload);

  const [row] = await db
    .insert(videos)
    .values({
      title: upload.title,
      description: upload.description,
      category: upload.category,
      uploader: user,
      fileName: upload.fileName,
      mimeType: upload.mimeType,
      fileSize: upload.fileSize,
      durationSeconds: upload.duration,
      thumbnail: upload.thumbnail,
      data: buffer,
    })
    .returning({ id: videos.id });

  return NextResponse.json({ ok: true, id: row.id });
}