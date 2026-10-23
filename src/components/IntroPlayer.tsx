"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SkipForward, Volume2 } from "lucide-react";
import VideoControls from "@/components/VideoControls";

const INTRO_VIDEO_URL = "/intro.mov";
const INTRO_FADE_MS = 400;
const INTRO_MAX_MS = 15000;

const NOW_PLAYING_ARTWORK = "/ph-artwork.jpeg";

function setNowPlaying(title: string, artist: string) {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title,
    artist,
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
  uploader = "PolHub",
}: {
  src: string;
  poster?: string | null;
  title?: string;
  uploader?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
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
    <div
      ref={containerRef}
      className="relative overflow-hidden rounded-xl bg-black"
    >
      <VideoControls
        videoRef={videoRef}
        containerRef={containerRef}
        onReplayIntro={runIntro}
        disabled={showIntro}
      >
      <video
        ref={videoRef}
        src={src}
        poster={poster ?? undefined}
        playsInline
        preload="auto"
        onPlay={() => setNowPlaying(title, uploader)}
        onLoadedMetadata={() => setNowPlaying(title, uploader)}
        className="aspect-video h-full w-full bg-black object-contain"
      />

      {showIntro && (
        <div
          onPointerDown={unmute}
          className={`absolute left-0 top-0 z-10 h-full w-full overflow-hidden bg-black transition-opacity duration-400 ${
            fading ? "opacity-0" : "opacity-100"
          }`}
        >
          <video
            ref={introRef}
            src={INTRO_VIDEO_URL}
            playsInline
            preload="auto"
            onPlay={() => setNowPlaying(title, uploader)}
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
      </VideoControls>
    </div>
  );
}
