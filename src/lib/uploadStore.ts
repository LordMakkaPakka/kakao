import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import os from "os";
import path from "path";

export type PendingUpload = {
  id: string;
  user: string;
  filePath: string;
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

export async function createPendingUpload(
  meta: Omit<PendingUpload, "id" | "filePath" | "received" | "createdAt">
): Promise<PendingUpload> {
  // porządki: usuń porzucone uploady starsze niż 2h
  const now = Date.now();
  for (const [key, up] of pendingUploads) {
    if (now - up.createdAt > 2 * 60 * 60 * 1000) {
      pendingUploads.delete(key);
      fs.unlink(up.filePath).catch(() => {});
    }
  }

  const id = randomUUID();
  const dir = path.join(os.tmpdir(), "polhub-uploads");
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `${id}.part`);
  await fs.writeFile(filePath, Buffer.alloc(0));

  const upload: PendingUpload = {
    ...meta,
    id,
    filePath,
    received: 0,
    createdAt: now,
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
  const buffer = await fs.readFile(upload.filePath);
  pendingUploads.delete(upload.id);
  fs.unlink(upload.filePath).catch(() => {});
  return buffer;
}