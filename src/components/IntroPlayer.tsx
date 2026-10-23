"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SkipForward, RotateCcw, Volume2 } from "lucide-react";

const INTRO_VIDEO_URL = "/intro.mov";
const INTRO_FADE_MS = 400;
const INTRO_MAX_MS = 15000;

const NOW_PLAYING_ARTWORK = "/ph-artwork.jpeg";

function setNowPlaying(title: string) {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title,
    artist: "PolHub",
    album: "PolHub",
    artwork: [96, 128, 192, 256, 384, 512].map((size) => ({
      src: NOW_PLAYING_ARTWORK,
      sizes: `${size}x${size}`,
      type: "image/jpeg",
    })),
  });
}

export default function IntroPlayer({
  src,
  poster,
  title = "PolHub",
}: {
  src: string;
  poster?: string | null;
  title?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const introRef = useRef<HTMLVideoElement>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [showIntro, setShowIntro] = useState(true);
  const [fading, setFading] = useState(false);
  const [muted, setMuted] = useState(false);

  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };

  const startVideo = useCallback(() => {
    clearTimers();
    introRef.current?.pause();
    setShowIntro(false);
    setFading(false);
    videoRef.current?.play().catch(() => {
      /* przeglądarka blokuje autoplay – użytkownik kliknie play */
    });
  }, []);

  const finishIntro = useCallback(() => {
    clearTimers();
    setFading(true);
    timersRef.current.push(setTimeout(startVideo, INTRO_FADE_MS));
  }, [startVideo]);

  const playIntro = useCallback(() => {
    const intro = introRef.current;
    if (!intro) return;
    intro.currentTime = 0;
    intro.muted = false;
    setMuted(false);
    intro.play().catch(() => {
      // autoplay z dźwiękiem zablokowany – odtwórz wyciszone
      intro.muted = true;
      setMuted(true);
      intro.play().catch(finishIntro);
    });
  }, [finishIntro]);

  const runIntro = useCallback(() => {
    clearTimers();
    videoRef.current?.pause();
    setFading(false);
    setShowIntro(true);
    timersRef.current.push(setTimeout(finishIntro, INTRO_MAX_MS));
  }, [finishIntro]);

  useEffect(() => {
    runIntro();
    return clearTimers;
  }, [runIntro]);

  useEffect(() => {
    if (showIntro) playIntro();
  }, [showIntro, playIntro]);

  const unmute = () => {
    const intro = introRef.current;
    if (intro && intro.muted) {
      intro.muted = false;
      setMuted(false);
    }
  };

  return (
    <div className="group/player relative overflow-hidden rounded-xl bg-black ring-1 ring-ph-border">
      <video
        ref={videoRef}
        src={src}
        poster={poster ?? undefined}
        controls
        playsInline
        preload="auto"
        onPlay={() => setNowPlaying(title)}
        onLoadedMetadata={() => setNowPlaying(title)}
        className="aspect-video w-full bg-black"
      />

      {showIntro && (
        <div
          onPointerDown={unmute}
          className={`absolute inset-0 z-10 bg-black transition-opacity duration-400 ${
            fading ? "opacity-0" : "opacity-100"
          }`}
        >
          <video
            ref={introRef}
            src={INTRO_VIDEO_URL}
            playsInline
            preload="auto"
            onPlay={() => setNowPlaying(title)}
            onEnded={finishIntro}
            onError={finishIntro}
            className="h-full w-full scale-[1.35] object-cover"
            aria-label="Intro Polhub"
          />

          {muted && (
            <p className="absolute bottom-4 left-4 flex items-center gap-1.5 rounded-md bg-black/60 px-2 py-1 text-[11px] text-white/80">
              <Volume2 className="h-3.5 w-3.5" /> kliknij, aby włączyć dźwięk
            </p>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              startVideo();
            }}
            className="absolute bottom-4 right-4 flex items-center gap-2 rounded-md border border-white/25 bg-black/60 px-4 py-2 text-xs font-bold text-white transition-all hover:border-ph-orange hover:bg-ph-orange hover:text-black sm:text-sm"
          >
            Pomiń intro <SkipForward className="h-4 w-4" />
          </button>
        </div>
      )}

      {!showIntro && (
        <button
          onClick={runIntro}
          title="Odtwórz intro ponownie"
          className="absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1.5 text-[11px] font-semibold text-ph-muted opacity-0 transition-all hover:bg-ph-orange hover:text-black group-hover/player:opacity-100"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Intro
        </button>
      )}
    </div>
  );
}
