"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  SkipForward,
  Volume2,
  Volume1,
  VolumeX,
  Maximize,
  Minimize,
  Play,
  Pause,
  Settings,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { formatDuration } from "@/lib/format";

/**
 * Intro PolHub jest częścią każdego filmu – odtwarzacz gra je jako pierwszy
 * fragment tego samego materiału (jedna oś czasu, jedno okno), a nie jako
 * osobną nakładkę. Intro zawsze idzie z dźwiękiem – nigdy nie jest wyciszane.
 */
const INTRO_SRC = "/intro.mov";
const HIDE_CONTROLS_MS = 2600;

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

type WebkitVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void };
type Phase = "intro" | "video";

const RATES = [0.5, 1, 1.5, 2];

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
  const trackRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draggingRef = useRef(false);
  const wantsPlayRef = useRef(true);
  const pendingSeekRef = useRef<number | null>(null);
  const volumeRef = useRef(1);
  const mutedRef = useRef(false);
  const rateRef = useRef(1);

  const [phase, setPhase] = useState<Phase>("intro");
  const [introDuration, setIntroDuration] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [introBroken, setIntroBroken] = useState(false);

  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [needsGesture, setNeedsGesture] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [time, setTime] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [hoverPct, setHoverPct] = useState<number | null>(null);
  const [rate, setRate] = useState(1);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const introLen = introBroken ? 0 : introDuration;
  const total = introLen + videoDuration;
  const position = phase === "intro" ? time : introLen + time;
  const progress = total > 0 ? Math.min(1, Math.max(0, position / total)) : 0;
  const bufferedPos = phase === "intro" ? buffered : introLen + buffered;
  const bufferedPct =
    total > 0 ? Math.min(1, Math.max(0, bufferedPos / total)) : 0;
  const hoverClamped =
    hoverPct === null ? 0 : Math.min(Math.max(hoverPct * 100, 7), 93);
  const isIntroPhase = phase === "intro" && !introBroken && introLen > 0;
  const barVisible =
    controlsVisible || !playing || settingsOpen || needsGesture || ended;
  const VolumeIcon =
    muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  /* ===== Długości obu części (intro + film) ===== */

  useEffect(() => {
    const introProbe = document.createElement("video");
    introProbe.preload = "metadata";
    introProbe.src = INTRO_SRC;
    introProbe.onloadedmetadata = () => {
      const d = introProbe.duration;
      if (Number.isFinite(d) && d > 0) setIntroDuration(d);
    };
    introProbe.onerror = () => {
      setIntroBroken(true);
      setPhase("video");
    };

    const videoProbe = document.createElement("video");
    videoProbe.preload = "metadata";
    videoProbe.src = src;
    videoProbe.onloadedmetadata = () => {
      const d = videoProbe.duration;
      if (Number.isFinite(d) && d > 0) setVideoDuration(d);
    };

    return () => {
      introProbe.removeAttribute("src");
      videoProbe.removeAttribute("src");
    };
  }, [src]);

  /* ===== Pełny ekran ===== */

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
      return;
    }
    const el = containerRef.current;
    if (el?.requestFullscreen) {
      el.requestFullscreen().catch(() => {
        (videoRef.current as WebkitVideo | null)?.webkitEnterFullscreen?.();
      });
    } else {
      (videoRef.current as WebkitVideo | null)?.webkitEnterFullscreen?.();
    }
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  /* ===== Pasek sterowania ===== */

  const pokeControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      const v = videoRef.current;
      if (v && !v.paused && !draggingRef.current) setControlsVisible(false);
    }, HIDE_CONTROLS_MS);
  }, []);

  useEffect(() => {
    const start = setTimeout(() => {
      const v = videoRef.current;
      if (v && !v.paused) setControlsVisible(false);
    }, HIDE_CONTROLS_MS);
    return () => {
      clearTimeout(start);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!settingsOpen) return;
    const onDocPointerDown = (e: globalThis.PointerEvent) => {
      const target = e.target as Node | null;
      if (
        settingsRef.current &&
        target &&
        !settingsRef.current.contains(target)
      ) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  }, [settingsOpen]);

  /* ===== Odtwarzanie ===== */

  const startPlayback = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    wantsPlayRef.current = true;
    v.play()
      .then(() => {
        setNeedsGesture(false);
        setNowPlaying(title, uploader);
      })
      .catch(() => setNeedsGesture(true));
  }, [title, uploader]);

  /* ===== Szukanie na wspólnej osi czasu ===== */

  const seekToPosition = useCallback((target: number) => {
    if (!total) return;
    const clamped = Math.max(0, Math.min(total, target));
    const nextPhase: Phase = introLen > 0 && clamped < introLen ? "intro" : "video";
    const local =
      nextPhase === "intro" ? clamped : Math.max(0, clamped - introLen);
    const v = videoRef.current;

    setEnded(false);
    wantsPlayRef.current = true;

    if (nextPhase === phase && v) {
      v.currentTime = local;
      setTime(local);
      // Przewinięcie nie zatrzymuje odtwarzania.
      if (v.paused) startPlayback();
      return;
    }
    pendingSeekRef.current = local;
    setTime(local);
    setPhase(nextPhase);
  }, [total, introLen, phase, startPlayback]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused || v.ended || needsGesture) {
      // Po zakończeniu film leci od nowa – razem z intro.
      if (ended) {
        seekToPosition(0);
        return;
      }
      startPlayback();
    } else {
      v.pause();
    }
    pokeControls();
  }, [needsGesture, ended, seekToPosition, startPlayback, pokeControls]);

  const onLoadedMetadata = () => {
    const v = videoRef.current;
    if (!v) return;

    v.volume = volumeRef.current;
    v.muted = mutedRef.current;
    v.playbackRate = rateRef.current;

    if (Number.isFinite(v.duration) && v.duration > 0) {
      if (phase === "intro") setIntroDuration(v.duration);
      else setVideoDuration(v.duration);
    }

    if (pendingSeekRef.current !== null) {
      v.currentTime = pendingSeekRef.current;
      pendingSeekRef.current = null;
    }

    if (wantsPlayRef.current) startPlayback();
  };

  const onEnded = () => {
    if (phase === "intro") {
      // Intro kończy się płynnie przejściem do właściwego filmu.
      wantsPlayRef.current = true;
      setTime(0);
      setPhase("video");
      return;
    }
    setPlaying(false);
    setWaiting(false);
    setEnded(true);
  };

  const onError = () => {
    if (phase === "intro") {
      setIntroBroken(true);
      wantsPlayRef.current = true;
      setPhase("video");
      return;
    }
    setWaiting(false);
  };

  const pctFromEvent = (clientX: number) => {
    const el = trackRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0) return 0;
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  };

  const onTrackPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingRef.current = true;
    seekToPosition(pctFromEvent(e.clientX) * total);
    setControlsVisible(true);
  };

  const onTrackPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const pct = pctFromEvent(e.clientX);
    setHoverPct(pct);
    if (draggingRef.current) seekToPosition(pct * total);
  };

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    draggingRef.current = false;
    pokeControls();
  };

  const skipIntro = () => {
    if (!introLen) return;
    seekToPosition(introLen + 0.05);
  };

  /* ===== Głośność i prędkość ===== */

  const setVolumeTo = (value: number) => {
    const v = videoRef.current;
    const next = Math.min(1, Math.max(0, value));
    volumeRef.current = next;
    mutedRef.current = next === 0;
    if (v) {
      v.volume = next;
      v.muted = next === 0;
    }
    setVolume(next);
    setMuted(next === 0);
  };

  const toggleMute = () => {
    const v = videoRef.current;
    const nextMuted = !(mutedRef.current || v?.muted);
    mutedRef.current = nextMuted;
    if (v) v.muted = nextMuted;
    setMuted(nextMuted);
    if (!nextMuted && volumeRef.current === 0) setVolumeTo(0.6);
  };

  const changeRate = (value: number) => {
    const v = videoRef.current;
    rateRef.current = value;
    if (v) v.playbackRate = value;
    setRate(value);
    setSettingsOpen(false);
  };

  /* ===== Klawiatura ===== */

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    switch (e.key) {
      case " ":
      case "k":
        e.preventDefault();
        togglePlay();
        break;
      case "ArrowRight":
        e.preventDefault();
        seekToPosition(position + 5);
        break;
      case "ArrowLeft":
        e.preventDefault();
        seekToPosition(position - 5);
        break;
      case "ArrowUp":
        e.preventDefault();
        setVolumeTo((muted ? 0 : volume) + 0.05);
        break;
      case "ArrowDown":
        e.preventDefault();
        setVolumeTo((muted ? 0 : volume) - 0.05);
        break;
      case "m":
        toggleMute();
        break;
      case "f":
        toggleFullscreen();
        break;
    }
  };

  const onVideoClick = (e: ReactMouseEvent<HTMLVideoElement>) => {
    // Pojedyncze kliknięcie = play/pause, podwójne = pełny ekran.
    if (e.detail > 1) return;
    containerRef.current?.focus({ preventScroll: true });
    setSettingsOpen(false);
    if (!controlsVisible && playing) {
      pokeControls();
      return;
    }
    togglePlay();
  };

  const showCenterButton = !playing || needsGesture || ended;

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onMouseMove={pokeControls}
      onMouseLeave={() => {
        if (playing && !draggingRef.current) setControlsVisible(false);
      }}
      onKeyDown={onKeyDown}
      className={`ph-player group/player relative w-full select-none overflow-hidden bg-black outline-none ${
        fullscreen ? "h-screen w-screen" : "aspect-video"
      }`}
      aria-label={`Odtwarzacz: ${title}`}
    >
      <video
        key={phase}
        ref={videoRef}
        src={phase === "intro" ? INTRO_SRC : src}
        poster={phase === "video" ? poster ?? undefined : undefined}
        playsInline
        preload="auto"
        onClick={onVideoClick}
        onDoubleClick={toggleFullscreen}
        onLoadedMetadata={onLoadedMetadata}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onProgress={(e) => {
          const v = e.currentTarget;
          if (v.buffered.length > 0) {
            setBuffered(v.buffered.end(v.buffered.length - 1));
          }
        }}
        onPlay={() => {
          setPlaying(true);
          setEnded(false);
          setNowPlaying(title, uploader);
        }}
        onPause={() => setPlaying(false)}
        onWaiting={() => setWaiting(true)}
        onPlaying={() => setWaiting(false)}
        onCanPlay={() => setWaiting(false)}
        onVolumeChange={(e) => {
          setVolume(e.currentTarget.volume);
          setMuted(e.currentTarget.muted);
        }}
        onEnded={onEnded}
        onError={onError}
        className="absolute inset-0 h-full w-full bg-black object-contain"
      />

      {/* Ładowanie */}
      {playing && waiting && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-ph-orange" />
        </div>
      )}

      {/* Duży przycisk play / powtórz */}
      {showCenterButton && !waiting && (
        <button
          type="button"
          onClick={togglePlay}
          aria-label={ended ? "Odtwórz ponownie" : "Odtwórz"}
          className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3"
        >
          <span className="flex h-[68px] w-[68px] items-center justify-center rounded-full bg-black/55 shadow-[0_4px_24px_rgba(0,0,0,0.6)] ring-1 ring-white/25 transition-all duration-150 hover:scale-105 hover:bg-ph-orange hover:ring-ph-orange sm:h-[76px] sm:w-[76px]">
            {ended ? (
              <RotateCcw className="h-7 w-7 text-white" />
            ) : (
              <Play className="ml-1 h-8 w-8 fill-white text-white" />
            )}
          </span>
          {needsGesture && (
            <span className="flex items-center gap-1.5 rounded-[3px] bg-black/70 px-2.5 py-1 text-[11px] font-semibold text-white/90">
              <Volume2 className="h-3.5 w-3.5 text-ph-orange" />
              Kliknij, aby odtworzyć z dźwiękiem
            </span>
          )}
        </button>
      )}

      {/* Znak wodny */}
      <div
        className={`pointer-events-none absolute bottom-11 right-2.5 z-20 transition-opacity duration-200 ${
          barVisible && !settingsOpen ? "opacity-90" : "opacity-0"
        }`}
      >
        <span className="font-display text-base font-black tracking-tight text-white/90 drop-shadow sm:text-lg">
          Pol
          <span className="ml-0.5 rounded-[3px] bg-ph-orange px-1 py-[1px] text-black">
            Hub
          </span>
        </span>
      </div>

      {/* Pasek sterowania */}
      <div
        className={`absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black via-black/80 to-transparent px-1.5 pb-1 pt-8 transition-opacity duration-200 sm:px-2 ${
          barVisible ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={togglePlay}
            aria-label={playing ? "Pauza" : "Odtwórz"}
            className="flex h-8 w-8 shrink-0 items-center justify-center text-white transition-colors hover:text-ph-orange focus:outline-none focus-visible:text-ph-orange"
          >
            {playing ? (
              <Pause className="h-5 w-5 fill-white" />
            ) : (
              <Play className="h-5 w-5 fill-white" />
            )}
          </button>

          <span className="w-9 shrink-0 text-center font-display text-[11px] font-semibold tabular-nums text-white">
            {formatDuration(position)}
          </span>

          <div
            ref={trackRef}
            role="slider"
            aria-label="Postęp filmu"
            aria-valuemin={0}
            aria-valuemax={Math.round(total)}
            aria-valuenow={Math.round(position)}
            tabIndex={-1}
            onPointerDown={onTrackPointerDown}
            onPointerMove={onTrackPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onPointerLeave={() => setHoverPct(null)}
            className="group/progress relative flex h-5 flex-1 cursor-pointer touch-none items-center"
          >
            <div className="relative h-[5px] w-full overflow-hidden rounded-[2px] bg-white/25">
              <div
                className="absolute inset-y-0 left-0 bg-white/40"
                style={{ width: `${bufferedPct * 100}%` }}
              />
              <div
                className="absolute inset-y-0 left-0 bg-ph-orange"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
            <span
              className={`pointer-events-none absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ph-orange shadow transition-opacity ${
                hoverPct !== null
                  ? "opacity-100"
                  : "opacity-0 group-hover/progress:opacity-100"
              }`}
              style={{ left: `${progress * 100}%` }}
            />

            {hoverPct !== null && total > 0 && (
              <div
                className="pointer-events-none absolute bottom-6 z-40 -translate-x-1/2"
                style={{ left: `${hoverClamped}%` }}
              >
                <div className="w-[136px] overflow-hidden rounded-[3px] border border-white/25 bg-black shadow-[0_6px_20px_rgba(0,0,0,0.8)]">
                  <div className="relative aspect-video">
                    {poster && hoverPct * total >= introLen ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={poster}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-ph-panel font-display text-[11px] font-black text-ph-orange">
                        INTRO
                      </div>
                    )}
                    <span className="absolute inset-x-0 bottom-0 bg-black/80 px-1 py-0.5 text-center font-display text-[10px] font-bold tabular-nums text-white">
                      {formatDuration(hoverPct * total)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <span className="hidden w-9 shrink-0 text-center font-display text-[11px] font-semibold tabular-nums text-white/80 sm:block">
            {formatDuration(total)}
          </span>

          <div className="group/vol flex shrink-0 items-center">
            <button
              type="button"
              onClick={toggleMute}
              aria-label={muted ? "Włącz dźwięk" : "Wycisz"}
              className="flex h-8 w-8 items-center justify-center text-white transition-colors hover:text-ph-orange focus:outline-none focus-visible:text-ph-orange"
            >
              <VolumeIcon className="h-5 w-5" />
            </button>
            <div className="w-0 overflow-hidden transition-all duration-200 group-hover/vol:w-[68px] group-focus-within/vol:w-[68px]">
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={muted ? 0 : volume}
                onChange={(e) => setVolumeTo(Number(e.target.value))}
                aria-label="Głośność"
                className="ph-volume mx-2 w-[52px] accent-ph-orange"
                style={{
                  backgroundSize: `${(muted ? 0 : volume) * 100}% 100%`,
                }}
              />
            </div>
          </div>

          <span
            title="Materiał w jakości HD"
            className="hidden shrink-0 rounded-[2px] bg-ph-orange px-1 py-[1px] font-display text-[10px] font-black leading-tight text-black sm:block"
          >
            HD
          </span>

          {isIntroPhase && (
            <button
              type="button"
              onClick={skipIntro}
              title="Pomiń intro"
              className="flex h-8 shrink-0 items-center gap-1 px-1.5 font-display text-[10px] font-black uppercase tracking-wide text-white/80 transition-colors hover:text-ph-orange"
            >
              Intro <SkipForward className="h-4 w-4" />
            </button>
          )}

          <div ref={settingsRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => setSettingsOpen((v) => !v)}
              aria-label="Ustawienia odtwarzania"
              aria-expanded={settingsOpen}
              className="flex h-8 w-8 items-center justify-center text-white transition-colors hover:text-ph-orange focus:outline-none focus-visible:text-ph-orange"
            >
              <Settings className="h-[18px] w-[18px]" />
            </button>
            {settingsOpen && (
              <div className="absolute bottom-full right-0 z-40 mb-2 w-36 overflow-hidden rounded-[3px] border border-white/15 bg-black/95 py-1 text-xs text-white shadow-[0_8px_24px_rgba(0,0,0,0.8)]">
                <p className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-white/45">
                  Prędkość
                </p>
                {RATES.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => changeRate(value)}
                    className={`flex w-full items-center justify-between px-3 py-1.5 text-left transition-colors hover:bg-white/10 ${
                      rate === value ? "text-ph-orange" : "text-white"
                    }`}
                  >
                    {value === 1 ? "Normalna" : `${value}x`}
                    {rate === value && <span className="text-ph-orange">✓</span>}
                  </button>
                ))}
                <p className="mt-1 border-t border-white/10 px-3 py-1.5 text-[10px] text-white/45">
                  Jakość: HD (auto)
                </p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={fullscreen ? "Wyjdź z pełnego ekranu" : "Pełny ekran"}
            className="flex h-8 w-8 shrink-0 items-center justify-center text-white transition-colors hover:text-ph-orange focus:outline-none focus-visible:text-ph-orange"
          >
            {fullscreen ? (
              <Minimize className="h-5 w-5" />
            ) : (
              <Maximize className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
