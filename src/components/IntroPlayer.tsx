"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SkipForward, RotateCcw, Volume2 } from "lucide-react";

const INTRO_TOTAL_MS = 3200;
const INTRO_FADE_MS = 450;

const INTRO_AUDIO_URL = "/intro.mp3";
let customIntroBuffer: Promise<ArrayBuffer | null> | null = null;

function loadCustomIntro() {
  customIntroBuffer ??= fetch(INTRO_AUDIO_URL)
    .then((res) => (res.ok ? res.arrayBuffer() : null))
    .catch(() => null);
  return customIntroBuffer;
}

/** Głęboki, rezonujący "bwooom" w stylu intro – syntezowany w Web Audio. */
function playSynthIntro(ctx: AudioContext) {
  const t0 = ctx.currentTime + 0.3;
  const duration = 2.2;

  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, t0);
  master.gain.exponentialRampToValueAtTime(0.8, t0 + 0.04);
  master.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.Q.value = 9;
  filter.frequency.setValueAtTime(1800, t0);
  filter.frequency.exponentialRampToValueAtTime(120, t0 + 1.4);

  filter.connect(master).connect(ctx.destination);

  [55, 55.6, 110.4].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = i === 2 ? "square" : "sawtooth";
    osc.frequency.setValueAtTime(freq * 1.5, t0);
    osc.frequency.exponentialRampToValueAtTime(freq, t0 + 0.12);
    const g = ctx.createGain();
    g.gain.value = i === 2 ? 0.15 : 0.35;
    osc.connect(g).connect(filter);
    osc.start(t0);
    osc.stop(t0 + duration);
  });

  const sub = ctx.createOscillator();
  sub.type = "sine";
  sub.frequency.setValueAtTime(80, t0);
  sub.frequency.exponentialRampToValueAtTime(41, t0 + 0.3);
  const subGain = ctx.createGain();
  subGain.gain.setValueAtTime(0.9, t0);
  subGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.6);
  sub.connect(subGain).connect(ctx.destination);
  sub.start(t0);
  sub.stop(t0 + 1.7);
}

async function playIntroSound(ctx: AudioContext) {
  const raw = await loadCustomIntro();
  if (raw) {
    try {
      const buffer = await ctx.decodeAudioData(raw.slice(0));
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(ctx.currentTime + 0.2);
      return;
    } catch {
      /* uszkodzony plik – użyj syntezy */
    }
  }
  playSynthIntro(ctx);
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
          playIntroSound(ctx);
        } else {
          ctx.resume().then(() => playIntroSound(ctx)).catch(() => {});
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
      ctx.resume().then(() => playIntroSound(ctx)).catch(() => {});
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
          <div
            className="intro-logo flex items-center text-5xl font-bold leading-none tracking-tight sm:text-8xl"
            style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
          >
            <span className="text-white">Pol</span>
            <span className="ml-[0.08em] rounded-[0.12em] bg-ph-orange px-[0.12em] pb-[0.1em] pt-[0.06em] text-black">
              hub
            </span>
          </div>

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
