/**
 * Przechowywanie plików wideo.
 *
 * Domyślnie film leży w bazie (kolumna `videos.data`) — proste, ale zjada
 * limit miejsca i na Vercelu nie da się odtworzyć plików większych niż
 * 4,5 MB (limit odpowiedzi funkcji serverless).
 *
 * Gdy ustawiona jest zmienna `BLOB_READ_WRITE_TOKEN` (magazyn Vercel Blob),
 * plik trafia do magazynu, a w bazie zostaje tylko adres — dzięki temu
 * duże filmy działają i baza się nie zapełnia.
 */

export type StoredVideo = {
  /** Dane do kolumny `videos.data` (puste, gdy plik jest w magazynie). */
  data: Buffer;
  /** Adres w magazynie zewnętrznym albo null. */
  fileUrl: string | null;
  /** Gdzie faktycznie wylądował plik. */
  storage: "blob" | "db";
};

export function blobStorageEnabled(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

/** Zapisuje film — do Vercel Blob, jeśli skonfigurowany, inaczej do bazy. */
export async function storeVideo(
  buffer: Buffer,
  meta: { uploadId: string; fileName: string; mimeType: string }
): Promise<StoredVideo> {
  if (!blobStorageEnabled()) {
    return { data: buffer, fileUrl: null, storage: "db" };
  }

  // Magazyn może nie odpowiadać (zły token, awaria, wolna sieć) — nie możemy
  // kazać użytkownikowi czekać w nieskończoność, więc po 8 s ratujemy się bazą.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    const { put } = await import("@vercel/blob");
    const safeName = meta.fileName.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-80);
    const blob = await put(`videos/${meta.uploadId}-${safeName}`, buffer, {
      access: "public",
      addRandomSuffix: true,
      contentType: meta.mimeType || "video/mp4",
      abortSignal: controller.signal,
    });
    return { data: Buffer.alloc(0), fileUrl: blob.url, storage: "blob" };
  } catch (err) {
    // Magazyn zawiódł (brak uprawnień, limit) — zapisujemy do bazy,
    // żeby użytkownik nie stracił wysłanego filmu.
    console.error("[polhub] Vercel Blob niedostępny, zapis do bazy:", err);
    return { data: buffer, fileUrl: null, storage: "db" };
  } finally {
    clearTimeout(timeout);
  }
}

/** Usuwa plik z magazynu (przy usuwaniu filmu). Błędy są ignorowane. */
export async function deleteStoredVideo(fileUrl: string | null): Promise<void> {
  if (!fileUrl || !blobStorageEnabled()) return;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  try {
    const { del } = await import("@vercel/blob");
    await del(fileUrl, { abortSignal: controller.signal });
  } catch (err) {
    console.error("[polhub] nie udało się usunąć pliku z magazynu:", err);
  } finally {
    clearTimeout(timeout);
  }
}
