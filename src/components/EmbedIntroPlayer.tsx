"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SkipForward, Volume2, VolumeX, Play, Loader2, ExternalLink } from "lucide-react";
import { formatDuration } from "@/lib/format";

/**
 * Odtwarzacz dla filmów wklejonych jako embed.
 *
 * Intro PolHub leci **przed** embedem: najpierw nasze intro (z dźwiękiem,
 * z przyciskiem „Pomiń intro”), a po nim w tym samym oknie pojawia się
 * odtwarzacz zewnętrznego serwisu. Tego samego intro nie da się wkleić
 * w plik, który leży na cudzym serwerze — dlatego jest osobnym etapem.
 */
const INTRO_SRC = "/intro.mov";
const FADE_MS = 320;

export default function EmbedIntroPlayer({
  embedUrl,
  provider,
  title,
  poster,
}: {
  embedUrl: string;
  provider?: string;
  title: string;
  poster?: string | null;
}) {
  const introRef = useRef<HTMLVideoElement>(null);
  const [phase, setPhase] = useState<"intro" | "embed">("intro");
  const [introMounted, setIntroMounted] = useState(true);
  const [introFading, setIntroFading] = useState(false);
  const [introDuration, setIntroDuration] = useState(0);
  const [introTime, setIntroTime] = useState(0);
  const [muted, setMuted] = useState(false);
  const [needsGesture, setNeedsGesture] = useState(false);
  const [started, setStarted] = useState(false);
  const [introBroken, setIntroBroken] = useState(false);

  const showEmbed = useCallback(() => {
    setPhase("embed");
    introRef.current?.pause();
    setIntroFading(true);
    setTimeout(() => setIntroMounted(false), FADE_MS);
  }, []);

  // Intro gra pierwsze — z dźwiękiem. Jeśli przeglądarka zablokuje
  // autoplay, leci wyciszone z wyraźnym przyciskiem (jak w głównym playerze).
  useEffect(() => {
    const intro = introRef.current;
    if (!intro) return;
    intro.play()
      .then(() => {
        setStarted(true);
        setNeedsGesture(false);
      })
      .catch(() => {
        intro.muted = true;
        setMuted(true);
        intro.play()
          .then(() => {
            setNeedsGesture(true);
            setStarted(true);
          })
          .catch(() => {
            // Nie da się w ogóle wystartować — nie blokujemy filmu.
            setStarted(true);
            setIntroBroken(true);
            showEmbed();
          });
      });
  }, [showEmbed]);

  // Intro bez metadanych (np. plik się nie doczytał) nie może zatrzymać filmu.
  useEffect(() => {
    const t = setTimeout(() => {
      const intro = introRef.current;
      if (intro && (!Number.isFinite(intro.duration) || intro.duration === 0)) {
        setIntroBroken(true);
        showEmbed();
      }
    }, 7000);
    return () => clearTimeout(t);
  }, [showEmbed]);

  const progress =
    introDuration > 0 ? Math.min(1, Math.max(0, introTime / introDuration)) : 0;

  return (
    <div className="relative overflow-hidden rounded-xl border border-ph-border bg-black">
      <div className="relative aspect-video w-full">
        {phase === "intro" && introMounted && !introBroken && (
          <video
            ref={introRef}
            src={INTRO_SRC}
            poster={poster ?? undefined}
            playsInline
            preload="auto"
            onLoadedMetadata={(e) => setIntroDuration(e.currentTarget.duration || 0)}
            onTimeUpdate={(e) => setIntroTime(e.currentTarget.currentTime)}
            onEnded={showEmbed}
            onError={() => {
              setIntroBroken(true);
              showEmbed();
            }}
            className={`absolute inset-0 h-full w-full bg-black object-contain transition-opacity duration-300 ${
              introFading ? "opacity-0" : "opacity-100"
            }`}
          />
        )}

        {phase === "embed" && (
          <iframe
            src={embedUrl}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-forms"
            className="absolute inset-0 h-full w-full border-0 bg-black"
          />
        )}

        {/* Pasek intro — widoczny tylko w czasie intra */}
        {phase === "intro" && !introBroken && (
          <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black via-black/70 to-transparent px-2 pb-2 pt-10">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold tabular-nums text-white">
                {formatDuration(introTime)}
              </span>
              <div className="h-[4px] flex-1 overflow-hidden rounded-[2px] bg-white/25">
                <div
                  className="h-full bg-ph-orange transition-[width] duration-200"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
              <span className="hidden text-[11px] tabular-nums text-white/70 sm:block">
                {introDuration ? formatDuration(introDuration) : "intro"}
              </span>
              <button
                type="button"
                onClick={() => {
                  const intro = introRef.current;
                  if (intro) intro.muted = !intro.muted;
                  setMuted((m) => !m);
                }}
                aria-label={muted ? "Włącz dźwięk" : "Wycisz"}
                className="flex h-8 w-8 items-center justify-center text-white transition-colors hover:text-ph-orange"
              >
                {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </button>
              <button
                type="button"
                onClick={showEmbed}
                className="flex h-8 items-center gap-1 px-1.5 font-display text-[10px] font-black uppercase tracking-wide text-white/80 transition-colors hover:text-ph-orange"
              >
                Intro <SkipForward className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Nakładka, gdy przeglądarka zablokowała dźwięk */}
        {phase === "intro" && !introBroken && needsGesture && started && (
          <button
            type="button"
            onClick={() => {
              const intro = introRef.current;
              if (!intro) return;
              intro.muted = false;
              setMuted(false);
              intro.play().catch(() => {});
              setNeedsGesture(false);
            }}
            className="absolute left-1/2 top-1/2 z-30 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full bg-ph-orange px-4 py-2 text-xs font-black text-black shadow-lg transition-transform hover:scale-105"
          >
            <Play className="h-4 w-4 fill-black" /> Włącz dźwięk intra
          </button>
        )}

        {phase === "intro" && !started && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-ph-orange" />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ph-border bg-ph-dark px-3 py-2 text-[11px] text-ph-muted">
        <span>
          Intro PolHub → film z {provider || "zewnętrznego serwisu"}
        </span>
        <a
          href={embedUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="flex items-center gap-1 transition-colors hover:text-ph-orange"
        >
          Otwórz w serwisie źródłowym <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}
