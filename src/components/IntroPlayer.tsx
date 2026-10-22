"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SkipForward, RotateCcw, Volume2 } from "lucide-react";

const INTRO_TOTAL_MS = 3200;
const INTRO_FADE_MS = 450;

/** Syntezowany bęben intro (ba-dum-tss) – generowany, bez zewnętrznych plików. */
function playIntroDrums(ctx: AudioContext) {
  const t0 = ctx.currentTime + 0.35;

  const kick = (time: number) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.22);
    gain.gain.setValueAtTime(0.9, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);
    osc.connect(gain).connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.32);
  };

  const tss = (time: number) => {
    const duration = 0.5;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 6500;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.35, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    noise.connect(filter).connect(gain).connect(ctx.destination);
    noise.start(time);
    noise.stop(time + duration);
  };

  kick(t0);
  kick(t0 + 0.32);
  tss(t0 + 0.64);
}

export default function IntroPlayer({
  src,
  poster,
}: {
  src: string;
  poster?: string | null;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const audioRef = useRef<AudioContext | null>(null);
  const [showIntro, setShowIntro] = useState(true);
  const [fading, setFading] = useState(false);
  const [started, setStarted] = useState(false);

  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };

  const startVideo = useCallback(() => {
    clearTimers();
    setShowIntro(false);
    setFading(false);
    const video = videoRef.current;
    if (video) {
      video.play().catch(() => {
        /* przeglądarka blokuje autoplay – użytkownik kliknie play */
      });
    }
  }, []);

  const runIntro = useCallback(() => {
    clearTimers();
    setShowIntro(true);
    setFading(false);
    setStarted(true);
    videoRef.current?.pause();

    // dźwięk (może wymagać kliknięcia – przeglądarki blokują autoplay audio)
    try {
      const Ctx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctx) {
        audioRef.current?.close().catch(() => {});
        const ctx = new Ctx();
        audioRef.current = ctx;
        if (ctx.state === "running") {
          playIntroDrums(ctx);
        } else {
          ctx.resume().then(() => playIntroDrums(ctx)).catch(() => {});
        }
      }
    } catch {
      /* bez dźwięku też jest pięknie */
    }

    timersRef.current.push(
      setTimeout(() => setFading(true), INTRO_TOTAL_MS - INTRO_FADE_MS),
      setTimeout(() => startVideo(), INTRO_TOTAL_MS)
    );
  }, [startVideo]);

  useEffect(() => {
    runIntro();
    return () => {
      clearTimers();
      audioRef.current?.close().catch(() => {});
    };
  }, [runIntro]);

  // pierwsze kliknięcie gdziekolwiek w odtwarzacz odblokowuje audio
  const unlockAudio = () => {
    const ctx = audioRef.current;
    if (ctx && ctx.state === "suspended") {
      ctx.resume().then(() => playIntroDrums(ctx)).catch(() => {});
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
        className="aspect-video w-full bg-black"
      />

      {/* INTRO OVERLAY */}
      {showIntro && (
        <div
          onPointerDown={unlockAudio}
          className={`absolute inset-0 z-10 flex flex-col items-center justify-center bg-black transition-opacity duration-500 ${
            fading ? "opacity-0" : "opacity-100"
          }`}
        >
          {/* ambient glow */}
          <div className="intro-glow pointer-events-none absolute left-1/2 top-1/2 h-56 w-[30rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-ph-orange/15 blur-3xl" />

          {/* logo */}
          <div className="intro-logo relative font-display text-5xl font-black tracking-tight sm:text-7xl">
            <span className="text-white">Pol</span>
            <span className="ml-2 inline-block rounded-lg bg-ph-orange px-3 py-1 text-black sm:rounded-xl sm:px-4">
              Hub
            </span>
          </div>
          <p className="intro-sub mt-4 text-xs font-semibold uppercase tracking-[0.4em] text-ph-muted sm:text-sm">
            przedstawia
          </p>

          {/* hint gdy audio zablokowane */}
          {started && (
            <p className="absolute bottom-4 left-4 flex items-center gap-1.5 text-[11px] text-ph-muted/70">
              <Volume2 className="h-3.5 w-3.5" /> kliknij, aby włączyć dźwięk intro
            </p>
          )}

          {/* skip */}
          <button
            onClick={startVideo}
            className="absolute bottom-4 right-4 flex items-center gap-2 rounded-md border border-white/25 bg-black/60 px-4 py-2 text-xs font-bold text-white transition-all hover:border-ph-orange hover:bg-ph-orange hover:text-black sm:text-sm"
          >
            Pomiń intro <SkipForward className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* replay intro */}
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