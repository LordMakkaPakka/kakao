"use client";

import { ChangeEvent, DragEvent, FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  UploadCloud,
  FileVideo,
  X,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { CATEGORIES, formatDuration } from "@/lib/format";
import { authFetch } from "@/lib/clientAuth";

const UPLOAD_CATEGORIES = CATEGORIES.filter((c) => c !== "Wszystkie" && c !== "Popularne");
const MAX_SIZE = 200 * 1024 * 1024;

function formatSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

function extractMeta(file: File): Promise<{ duration: number; thumbnail: string | null }> {
  return new Promise((resolve) => {
    let settled = false;
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;

    const done = (duration: number, thumbnail: string | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      URL.revokeObjectURL(url);
      resolve({ duration, thumbnail });
    };

    const timeout = setTimeout(() => done(0, null), 6000);

    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      const capture = () => {
        try {
          const canvas = document.createElement("canvas");
          const scale = Math.min(1, 480 / (video.videoWidth || 480));
          canvas.width = Math.max(2, Math.round((video.videoWidth || 480) * scale));
          canvas.height = Math.max(2, Math.round((video.videoHeight || 270) * scale));
          const ctx = canvas.getContext("2d");
          if (!ctx) return done(duration, null);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          done(duration, canvas.toDataURL("image/jpeg", 0.7));
        } catch {
          done(duration, null);
        }
      };
      video.onseeked = capture;
      try {
        video.currentTime = Math.min(1, duration > 0 ? duration / 2 : 0.1);
      } catch {
        capture();
      }
    };
    video.onerror = () => done(0, null);
    video.src = url;
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function postChunk(
  uploadId: string,
  offset: number,
  blob: Blob
): Promise<{ received?: number; error?: string; status: number }> {
  const res = await authFetch(`/api/uploads/${uploadId}/chunk?offset=${offset}`, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream" },
    body: blob,
  });
  const data = await res.json().catch(() => ({}));
  return { ...data, status: res.status };
}

export default function UploadForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState(0);
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("Amatorskie");
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authError, setAuthError] = useState(false);
  const [sentBytes, setSentBytes] = useState<number | null>(null);
  const [phase, setPhase] = useState<"idle" | "sending" | "saving">("idle");
  const [success, setSuccess] = useState(false);

  const uploading = phase !== "idle";
  const progress =
    sentBytes !== null && file ? Math.min(100, Math.round((sentBytes / file.size) * 100)) : 0;

  async function pickFile(f: File | undefined | null) {
    setError(null);
    if (!f) return;
    const looksLikeVideo =
      f.type.startsWith("video/") || /\.(mp4|webm|mov|m4v|mkv|avi|ogv)$/i.test(f.name);
    if (!looksLikeVideo) {
      setError("To nie wygląda na plik wideo. Wybierz np. MP4 lub WebM.");
      return;
    }
    if (f.size > MAX_SIZE) {
      setError(`Plik ma ${formatSize(f.size)} — maksymalnie 200 MB.`);
      return;
    }
    setFile(f);
    setTitle((t) => t || f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "));
    const meta = await extractMeta(f);
    setDuration(meta.duration);
    setThumbnail(meta.thumbnail);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    pickFile(e.dataTransfer.files?.[0]);
  }

  function onInputChange(e: ChangeEvent<HTMLInputElement>) {
    pickFile(e.target.files?.[0]);
    e.target.value = "";
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setAuthError(false);
    if (!file) return setError("Najpierw wybierz plik wideo.");
    if (!title.trim()) return setError("Podaj tytuł filmu.");
    if (uploading) return;

    setPhase("sending");
    setSentBytes(0);

    try {
      // 1. Rozpocznij upload
      const initRes = await authFetch("/api/uploads/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || "video/mp4",
          title: title.trim(),
          description: description.trim(),
          category,
          duration: Math.round(duration),
          thumbnail,
        }),
      });
      const init = await initRes.json().catch(() => ({}));
      if (!initRes.ok) {
        if (initRes.status === 401) setAuthError(true);
        throw new Error(init.error ?? "Nie udało się rozpocząć przesyłania.");
      }

      const { uploadId, chunkSize } = init as { uploadId: string; chunkSize: number };

      // 2. Wysyłaj fragmenty z ponawianiem
      let offset = 0;
      while (offset < file.size) {
        const end = Math.min(offset + chunkSize, file.size);
        const blob = file.slice(offset, end);
        let attempt = 0;
        let ok = false;

        while (attempt < 4 && !ok) {
          try {
            const result = await postChunk(uploadId, offset, blob);
            if (result.status >= 200 && result.status < 300) {
              ok = true;
            } else if (result.status === 401) {
              setAuthError(true);
              throw new Error("Sesja wygasła — zaloguj się ponownie.");
            } else if (result.status === 404 || result.status === 409) {
              throw new Error(result.error ?? "Upload wygasł. Spróbuj ponownie.");
            } else {
              throw new Error("retry");
            }
          } catch (err) {
            if (err instanceof Error && err.message !== "retry") throw err;
            attempt++;
            if (attempt >= 4) {
              throw new Error(
                "Przerwano: nie udało się wysłać fragmentu po 4 próbach. Sprawdź połączenie i spróbuj ponownie."
              );
            }
            await sleep(600 * attempt);
          }
        }

        offset = end;
        setSentBytes(offset);
      }

      // 3. Finalizacja – zapis filmu w bazie
      setPhase("saving");
      const doneRes = await authFetch(`/api/uploads/${uploadId}/complete`, { method: "POST" });
      const doneData = await doneRes.json().catch(() => ({}));
      if (!doneRes.ok) {
        throw new Error(doneData.error ?? "Nie udało się zapisać filmu.");
      }

      setSuccess(true);
      setTimeout(() => {
        router.push(`/watch/${doneData.id}`);
        router.refresh();
      }, 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Przesyłanie nie powiodło się.");
      setPhase("idle");
      setSentBytes(null);
    }
  }

  if (success) {
    return (
      <div className="animate-fade-up rounded-2xl border border-green-500/40 bg-green-500/10 p-12 text-center">
        <CheckCircle2 className="mx-auto h-14 w-14 text-green-400" />
        <h2 className="mt-4 font-display text-2xl font-black text-white">Film wrzucony!</h2>
        <p className="mt-2 text-sm text-ph-muted">
          Intro PolHub dodane automatycznie 🥁 Zaraz obejrzysz swój film…
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="animate-fade-up space-y-6">
      {/* Dropzone */}
      {!file ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-16 transition-all ${
            dragging
              ? "border-ph-orange bg-ph-orange/10 shadow-[0_0_30px_rgba(255,144,0,0.2)]"
              : "border-ph-border bg-ph-dark hover:border-ph-orange/60 hover:bg-ph-panel"
          }`}
        >
          <UploadCloud className={`h-14 w-14 ${dragging ? "text-ph-orange" : "text-ph-muted"}`} />
          <p className="mt-4 font-display text-lg font-bold text-white">
            Przeciągnij i upuść plik wideo
          </p>
          <p className="mt-1 text-sm text-ph-muted">albo kliknij, aby wybrać z dysku</p>
          <p className="mt-4 rounded-full bg-ph-panel px-3 py-1 text-xs text-ph-muted">
            MP4, WebM, MOV • maks. 200 MB • wysyłanie w kawałkach z auto-ponawianiem
          </p>
          <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-ph-orange">
            <span className="inline-block h-2 w-2 rounded-sm bg-ph-orange" />
            Każdy film automatycznie dostaje kultowe intro PolHub 🥁
          </p>
        </button>
      ) : (
        <div className="flex items-center gap-4 rounded-2xl border border-ph-border bg-ph-dark p-4">
          <div className="relative h-20 w-32 shrink-0 overflow-hidden rounded-lg bg-black">
            {thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumbnail} alt="Miniatura" className="h-full w-full object-cover" />
            ) : (
              <FileVideo className="m-auto mt-6 h-8 w-8 text-ph-muted" />
            )}
            {duration > 0 && (
              <span className="absolute bottom-1 right-1 rounded bg-black/85 px-1 text-[10px] font-bold text-white">
                {formatDuration(duration)}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{file.name}</p>
            <p className="mt-0.5 text-xs text-ph-muted">{formatSize(file.size)}</p>
          </div>
          {!uploading && (
            <button
              type="button"
              onClick={() => {
                setFile(null);
                setThumbnail(null);
                setDuration(0);
              }}
              className="rounded-full p-2 text-ph-muted transition-colors hover:bg-ph-panel hover:text-red-400"
              aria-label="Usuń plik"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="video/*,.mkv,.mov,.m4v"
        className="hidden"
        onChange={onInputChange}
      />

      {/* Fields */}
      <div className="grid gap-5 rounded-2xl border border-ph-border bg-ph-dark p-6 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ph-muted">
            Tytuł *
          </span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={150}
            placeholder="Np. Mój kot robi salto (HD)"
            className="w-full rounded-lg border border-ph-border bg-ph-black px-3 py-3 text-sm text-white placeholder-ph-muted outline-none transition-colors focus:border-ph-orange"
            required
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ph-muted">
            Kategoria
          </span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-lg border border-ph-border bg-ph-black px-3 py-3 text-sm text-white outline-none transition-colors focus:border-ph-orange"
          >
            {UPLOAD_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ph-muted">
            Opis
          </span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
            rows={4}
            placeholder="Opowiedz światu, co widać na filmie…"
            className="w-full resize-none rounded-lg border border-ph-border bg-ph-black px-3 py-3 text-sm text-white placeholder-ph-muted outline-none transition-colors focus:border-ph-orange"
          />
        </label>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {error}{" "}
            {authError && (
              <Link href="/login" className="font-bold underline hover:text-red-300">
                Przejdź do logowania →
              </Link>
            )}
          </span>
        </div>
      )}

      {uploading && sentBytes !== null && file && (
        <div>
          <div className="mb-1.5 flex justify-between text-xs text-ph-muted">
            <span>
              {phase === "saving"
                ? "Zapisywanie filmu w bazie…"
                : `Wysyłanie: ${formatSize(sentBytes)} / ${formatSize(file.size)}`}
            </span>
            <span className="font-bold text-ph-orange">{progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-ph-panel">
            <div
              className="h-full rounded-full bg-gradient-to-r from-ph-orange to-ph-orange-hover transition-all"
              style={{ width: `${phase === "saving" ? 100 : progress}%` }}
            />
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={uploading}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-ph-orange py-3.5 font-display text-sm font-black uppercase tracking-wide text-black transition-all hover:bg-ph-orange-hover hover:shadow-[0_0_24px_rgba(255,144,0,0.4)] disabled:opacity-60"
      >
        {uploading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            {phase === "saving" ? "Zapisywanie…" : "Wysyłanie na PolHub…"}
          </>
        ) : (
          <>
            <UploadCloud className="h-5 w-5" /> Opublikuj film
          </>
        )}
      </button>
    </form>
  );
}