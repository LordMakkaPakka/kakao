import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { videos } from "@/db/schema";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const videoId = Number(id);
  if (!Number.isInteger(videoId)) {
    return new NextResponse("Bad request", { status: 400 });
  }

  const [row] = await db
    .select({ data: videos.data, mimeType: videos.mimeType })
    .from(videos)
    .where(eq(videos.id, videoId))
    .limit(1);

  if (!row) return new NextResponse("Not found", { status: 404 });

  const buffer = row.data;
  const total = buffer.length;
  const range = req.headers.get("range");

  if (range) {
    const match = /bytes=(\d*)-(\d*)/.exec(range);
    let start = match?.[1] ? parseInt(match[1], 10) : 0;
    let end = match?.[2] ? parseInt(match[2], 10) : total - 1;
    if (Number.isNaN(start)) start = 0;
    if (Number.isNaN(end) || end >= total) end = total - 1;

    if (start > end || start >= total) {
      return new NextResponse(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${total}` },
      });
    }

    const chunk = buffer.subarray(start, end + 1);
    return new NextResponse(new Uint8Array(chunk), {
      status: 206,
      headers: {
        "Content-Type": row.mimeType,
        "Content-Length": String(chunk.length),
        "Content-Range": `bytes ${start}-${end}/${total}`,
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=3600",
      },
    });
  }

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": row.mimeType,
      "Content-Length": String(total),
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=3600",
    },
  });
}