import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { videos } from "@/db/schema";
import { getUserFromRequest } from "@/lib/auth";
import { bannedResponse } from "@/lib/moderation";
import { ensureSchema } from "@/lib/dbInit";
import { finalizeUpload, findPendingUpload } from "@/lib/uploadStore";
import { storeVideo } from "@/lib/videoStorage";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  await ensureSchema();
  const user = getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Brak sesji." }, { status: 401 });
  }

  const blocked = await bannedResponse(user);
  if (blocked) return blocked;

  const { id } = await ctx.params;
  const upload = await findPendingUpload(id, user);
  if (!upload) {
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
  // Duże filmy idą do magazynu (Vercel Blob), gdy jest skonfigurowany;
  // w przeciwnym razie lądują w bazie, jak dotychczas.
  const stored = await storeVideo(buffer, {
    uploadId: upload.id,
    fileName: upload.fileName,
    mimeType: upload.mimeType,
  });

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
      fileUrl: stored.fileUrl,
      data: stored.data,
    })
    .returning({ id: videos.id });

  return NextResponse.json({ ok: true, id: row.id, storage: stored.storage });
}