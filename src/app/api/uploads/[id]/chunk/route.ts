import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { appendChunk, CHUNK_SIZE, pendingUploads } from "@/lib/uploadStore";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
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

  const offset = Number(req.nextUrl.searchParams.get("offset"));
  if (!Number.isFinite(offset) || offset < 0) {
    return NextResponse.json({ error: "Brak offsetu." }, { status: 400 });
  }

  const data = Buffer.from(await req.arrayBuffer());
  if (data.length === 0 || data.length > CHUNK_SIZE + 1024) {
    return NextResponse.json({ error: "Nieprawidłowy fragment." }, { status: 400 });
  }
  if (offset + data.length > upload.fileSize) {
    return NextResponse.json({ error: "Fragment poza rozmiarem pliku." }, { status: 400 });
  }

  try {
    const received = await appendChunk(upload, offset, data);
    return NextResponse.json({ ok: true, received });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Błąd zapisu fragmentu." },
      { status: 409 }
    );
  }
}