import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { and, asc, eq, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { pendingUploads as pendingTable, uploadParts } from "@/db/schema";
import { ensureSchema } from "@/lib/dbInit";

export type UploadStorage = "disk" | "db";

export type PendingUpload = {
  id: string;
  user: string;
  /** Ścieżka pliku tymczasowego (tylko dla storage = "disk"). */
  filePath: string;
  storage: UploadStorage;
  fileSize: number;
  received: number;
  fileName: string;
  mimeType: string;
  title: string;
  description: string;
  category: string;
  duration: number;
  thumbnail: string | null;
  createdAt: number;
};

const globalStore = globalThis as typeof globalThis & {
  __polhubUploads?: Map<string, PendingUpload>;
};

export const pendingUploads: Map<string, PendingUpload> =
  globalStore.__polhubUploads ?? new Map();
globalStore.__polhubUploads = pendingUploads;

export const MAX_UPLOAD_SIZE = 200 * 1024 * 1024; // 200 MB
export const CHUNK_SIZE = 4 * 1024 * 1024; // 4 MB

const STALE_MS = 2 * 60 * 60 * 1000; // porzucone uploady po 2 h

/**
 * Na Vercelu (i innych platformach serverless) każdy request może trafić na
 * inną instancję: pamięć i /tmp nie są współdzielone, więc fragmenty pliku
 * musimy trzymać w bazie. Lokalnie zostajemy przy dysku (szybciej i bez
 * obciążania bazy).
 */
export function uploadStorage(): UploadStorage {
  const forced = process.env.POLHUB_UPLOAD_STORAGE;
  if (forced === "db" || forced === "disk") return forced;
  return process.env.VERCEL ? "db" : "disk";
}

async function cleanupStale(): Promise<void> {
  const cutoff = Date.now() - STALE_MS;
  for (const [key, up] of pendingUploads) {
    if (now2() - up.createdAt > STALE_MS) {
      pendingUploads.delete(key);
      if (up.filePath) fs.unlink(up.filePath).catch(() => {});
    }
  }
  if (uploadStorage() === "db") {
    await ensureSchema();
    const threshold = new Date(cutoff);
    await db.delete(uploadParts).where(
      sql`${uploadParts.uploadId} in (select id from ${pendingTable} where created_at < ${threshold})`
    );
    await db.delete(pendingTable).where(lt(pendingTable.createdAt, threshold));
  }
}

function now2(): number {
  return Date.now();
}

export async function createPendingUpload(
  meta: Omit<
    PendingUpload,
    "id" | "filePath" | "received" | "createdAt" | "storage"
  >
): Promise<PendingUpload> {
  await cleanupStale();

  const id = randomUUID();
  const createdAt = Date.now();
  const storage = uploadStorage();

  if (storage === "db") {
    await ensureSchema();
    await db.insert(pendingTable).values({
      id,
      user: meta.user,
      fileName: meta.fileName,
      mimeType: meta.mimeType,
      title: meta.title,
      description: meta.description,
      category: meta.category,
      duration: meta.duration,
      thumbnail: meta.thumbnail,
      fileSize: meta.fileSize,
      received: 0,
    });
    return { ...meta, id, filePath: "", storage, received: 0, createdAt };
  }

  const dir = path.join(os.tmpdir(), "polhub-uploads");
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `${id}.part`);
  await fs.writeFile(filePath, Buffer.alloc(0));

  const upload: PendingUpload = {
    ...meta,
    id,
    filePath,
    storage,
    received: 0,
    createdAt,
  };
  pendingUploads.set(id, upload);
  return upload;
}

/** Znajduje trwający upload — w pamięci, a na serverless w bazie. */
export async function findPendingUpload(
  id: string,
  user: string
): Promise<PendingUpload | null> {
  const inMemory = pendingUploads.get(id);
  if (inMemory && inMemory.user === user) return inMemory;
  if (!process.env.VERCEL && uploadStorage() !== "db") return null;

  await ensureSchema();
  const [row] = await db
    .select()
    .from(pendingTable)
    .where(and(eq(pendingTable.id, id), eq(pendingTable.user, user)))
    .limit(1);
  if (!row) return null;

  const upload: PendingUpload = {
    id: row.id,
    user: row.user,
    filePath: "",
    storage: "db",
    fileSize: row.fileSize,
    received: row.received,
    fileName: row.fileName,
    mimeType: row.mimeType,
    title: row.title,
    description: row.description,
    category: row.category,
    duration: row.duration,
    thumbnail: row.thumbnail,
    createdAt: row.createdAt.getTime(),
  };
  pendingUploads.set(id, upload);
  return upload;
}

export async function appendChunk(
  upload: PendingUpload,
  offset: number,
  data: Buffer
): Promise<number> {
  // Ponowienie: jeśli klient wysyła ten sam fragment drugi raz, nadpisujemy go
  if (offset > upload.received) {
    throw new Error(`Nieprawidłowy offset ${offset}, oczekiwano ${upload.received}`);
  }

  if (upload.storage === "db") {
    await ensureSchema();
    await db
      .insert(uploadParts)
      .values({ uploadId: upload.id, offset, data })
      .onConflictDoUpdate({
        target: [uploadParts.uploadId, uploadParts.offset],
        set: { data },
      });
    const received = Math.max(upload.received, offset + data.length);
    await db
      .update(pendingTable)
      .set({ received })
      .where(eq(pendingTable.id, upload.id));
    upload.received = received;
    return received;
  }

  const handle = await fs.open(upload.filePath, "r+");
  try {
    await handle.write(data, 0, data.length, offset);
    await handle.truncate(offset + data.length);
  } finally {
    await handle.close();
  }
  upload.received = offset + data.length;
  return upload.received;
}

export async function finalizeUpload(upload: PendingUpload): Promise<Buffer> {
  if (upload.storage === "db") {
    await ensureSchema();
    const parts = await db
      .select({ offset: uploadParts.offset, data: uploadParts.data })
      .from(uploadParts)
      .where(eq(uploadParts.uploadId, upload.id))
      .orderBy(asc(uploadParts.offset));

    const buffer = Buffer.concat(parts.map((p) => Buffer.from(p.data)));
    await db.delete(uploadParts).where(eq(uploadParts.uploadId, upload.id));
    await db.delete(pendingTable).where(eq(pendingTable.id, upload.id));
    pendingUploads.delete(upload.id);
    return buffer;
  }

  const buffer = await fs.readFile(upload.filePath);
  pendingUploads.delete(upload.id);
  fs.unlink(upload.filePath).catch(() => {});
  return buffer;
}
