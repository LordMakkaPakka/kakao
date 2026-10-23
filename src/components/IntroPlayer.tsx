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

const INTRO_VIDEO_URL = "/intro.mov";
const INTRO_FADE_MS = 400;
const INTRO_MAX_MS = 15000;
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
  const introRef = useRef<HTMLVideoElement>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draggingRef = useRef(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  const [showIntro, setShowIntro] = useState(true);
  const [fading, setFading] = useState(false);
  const [introMuted, setIntroMuted] = useState(false);

  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [hoverPct, setHoverPct] = useState<number | null>(null);
  const [rate, setRate] = useState(1);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };

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
      // iPhone: tylko element wideo może przejść na pełny ekran
      (videoRef.current as WebkitVideo | null)?.webkitEnterFullscreen?.();
    }
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  /* ===== Intro PolHub ===== */

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
    setIntroMuted(false);
    intro.play().catch(() => {
      intro.muted = true;
      setIntroMuted(true);
      intro.play().catch(finishIntro);
    });
  }, [finishIntro]);

  useEffect(() => {
    videoRef.current?.pause();
    timersRef.current.push(setTimeout(finishIntro, INTRO_MAX_MS));
    playIntro();
    return clearTimers;
  }, [finishIntro, playIntro]);

  const unmuteIntro = () => {
    const intro = introRef.current;
    if (intro && intro.muted) {
      intro.muted = false;
      setIntroMuted(false);
    }
  };

  /* ===== Odtwarzacz ===== */

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const onTime = () => setTime(v.currentTime);
    const onDuration = () =>
      setDuration(Number.isFinite(v.duration) ? v.duration : 0);
    const onProgress = () => {
      if (v.buffered.length > 0) {
        setBuffered(v.buffered.end(v.buffered.length - 1));
      }
    };
    const onPlay = () => {
      setPlaying(true);
      setEnded(false);
      setNowPlaying(title, uploader);
    };
    const onPause = () => setPlaying(false);
    const onVolume = () => {
      setVolume(v.volume);
      setMuted(v.muted);
    };
    const onWaiting = () => setWaiting(true);
    const onPlayingState = () => setWaiting(false);
    const onEnded = () => {
      setPlaying(false);
      setEnded(true);
      setWaiting(false);
    };

    v.addEventListener("timeupdate", onTime);
    v.addEventListener("durationchange", onDuration);
    v.addEventListener("loadedmetadata", onDuration);
    v.addEventListener("progress", onProgress);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("volumechange", onVolume);
    v.addEventListener("waiting", onWaiting);
    v.addEventListener("playing", onPlayingState);
    v.addEventListener("canplay", onPlayingState);
    v.addEventListener("ended", onEnded);

    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("durationchange", onDuration);
      v.removeEventListener("loadedmetadata", onDuration);
      v.removeEventListener("progress", onProgress);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("volumechange", onVolume);
      v.removeEventListener("waiting", onWaiting);
      v.removeEventListener("playing", onPlayingState);
      v.removeEventListener("canplay", onPlayingState);
      v.removeEventListener("ended", onEnded);
    };
  }, [title, uploader]);

  // Pasek sterowania chowa się sam, gdy film leci.
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

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.ended) v.currentTime = 0;
    if (v.paused || v.ended) {
      v.play().catch(() => {});
    } else {
      v.pause();
    }
    pokeControls();
  }, [pokeControls]);

  const onVideoClick = (e: ReactMouseEvent<HTMLVideoElement>) => {
    // Pojedyncze kliknięcie = play/pause, podwójne = pełny ekran.
    if (e.detail > 1) return;
    containerRef.current?.focus({ preventScroll: true });
    setSettingsOpen(false);
    // Gdy pasek jest schowany, pierwsze kliknięcie tylko go pokazuje.
    if (!controlsVisible && playing) {
      pokeControls();
      return;
    }
    togglePlay();
  };

  /* ===== Pasek postępu ===== */

  const trackRef = useRef<HTMLDivElement>(null);

  const pctFromEvent = (clientX: number) => {
    const el = trackRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0) return 0;
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  };

  const seekToPct = (pct: number) => {
    const v = videoRef.current;
    if (!v || !Number.isFinite(v.duration)) return;
    const next = pct * v.duration;
    v.currentTime = next;
    setTime(next);
  };

  const onTrackPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingRef.current = true;
    seekToPct(pctFromEvent(e.clientX));
    setControlsVisible(true);
  };

  const onTrackPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const pct = pctFromEvent(e.clientX);
    setHoverPct(pct);
    if (draggingRef.current) seekToPct(pct);
  };

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    draggingRef.current = false;
    pokeControls();
  };

  /* ===== Głośność ===== */

  const setVolumeTo = (value: number) => {
    const v = videoRef.current;
    if (!v) return;
    const next = Math.min(1, Math.max(0, value));
    v.volume = next;
    v.muted = next === 0;
    setVolume(next);
    setMuted(next === 0);
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.muted || v.volume === 0) {
      v.muted = false;
      if (v.volume === 0) v.volume = 0.6;
    } else {
      v.muted = true;
    }
  };

  useEffect(() => {
    if (!settingsOpen) return;
    const onDocPointerDown = (e: globalThis.PointerEvent) => {
      const target = e.target as Node | null;
      if (settingsRef.current && target && !settingsRef.current.contains(target)) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  }, [settingsOpen]);

  const changeRate = (value: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = value;
    setRate(value);
    setSettingsOpen(false);
  };

  /* ===== Klawiatura ===== */

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const v = videoRef.current;
    if (!v) return;
    switch (e.key) {
      case " ":
      case "k":
        e.preventDefault();
        togglePlay();
        break;
      case "ArrowRight":
        e.preventDefault();
        v.currentTime = Math.min(v.duration || 0, v.currentTime + 5);
        break;
      case "ArrowLeft":
        e.preventDefault();
        v.currentTime = Math.max(0, v.currentTime - 5);
        break;
      case "ArrowUp":
        e.preventDefault();
        setVolumeTo((v.muted ? 0 : v.volume) + 0.05);
        break;
      case "ArrowDown":
        e.preventDefault();
        setVolumeTo((v.muted ? 0 : v.volume) - 0.05);
        break;
      case "m":
        toggleMute();
        break;
      case "f":
        toggleFullscreen();
        break;
    }
  };

  const progress = duration > 0 ? Math.min(1, time / duration) : 0;
  const bufferedPct =
    duration > 0 ? Math.min(1, Math.max(0, buffered / duration)) : 0;
  const hoverClamped =
    hoverPct === null ? 0 : Math.min(Math.max(hoverPct * 100, 7), 93);
  const showCenterPlay = !showIntro && (!playing || ended);
  const barVisible = controlsVisible || !playing || settingsOpen || showIntro;

  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

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
        ref={videoRef}
        src={src}
        poster={poster ?? undefined}
        playsInline
        preload="auto"
        onClick={onVideoClick}
        onDoubleClick={toggleFullscreen}
        className="absolute inset-0 h-full w-full bg-black object-contain"
      />

      {/* Ładowanie */}
      {playing && waiting && !showIntro && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-ph-orange" />
        </div>
      )}

      {/* Duży przycisk play / powtórz */}
      {showCenterPlay && (
        <button
          type="button"
          onClick={togglePlay}
          aria-label={ended ? "Odtwórz ponownie" : "Odtwórz"}
          className="absolute inset-0 z-20 flex items-center justify-center"
        >
          <span className="flex h-[68px] w-[68px] items-center justify-center rounded-full bg-black/55 shadow-[0_4px_24px_rgba(0,0,0,0.6)] ring-1 ring-white/25 transition-all duration-150 hover:scale-105 hover:bg-ph-orange hover:ring-ph-orange sm:h-[76px] sm:w-[76px]">
            {ended ? (
              <RotateCcw className="h-7 w-7 text-white" />
            ) : (
              <Play className="ml-1 h-8 w-8 fill-white text-white" />
            )}
          </span>
        </button>
      )}

      {/* Znak wodny – jak logo serwisu w rogu playera */}
      {!showIntro && (
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
      )}

      {/* Pasek sterowania */}
      <div
        className={`absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black via-black/80 to-transparent px-1.5 pb-1 pt-8 transition-opacity duration-200 sm:px-2 ${
          barVisible ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Play / Pause */}
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

          {/* Czas bieżący */}
          <span className="w-9 shrink-0 text-center font-display text-[11px] font-semibold tabular-nums text-white">
            {formatDuration(time)}
          </span>

          {/* Pasek postępu */}
          <div
            ref={trackRef}
            role="slider"
            aria-label="Postęp filmu"
            aria-valuemin={0}
            aria-valuemax={Math.round(duration)}
            aria-valuenow={Math.round(time)}
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
            {/* uchwyt */}
            <span
              className={`pointer-events-none absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ph-orange shadow transition-opacity ${
                hoverPct !== null
                  ? "opacity-100"
                  : "opacity-0 group-hover/progress:opacity-100"
              }`}
              style={{ left: `${progress * 100}%` }}
            />

            {/* Podgląd klatki nad paskiem */}
            {hoverPct !== null && duration > 0 && (
              <div
                className="pointer-events-none absolute bottom-6 z-40 -translate-x-1/2"
                style={{ left: `${hoverClamped}%` }}
              >
                <div className="w-[136px] overflow-hidden rounded-[3px] border border-white/25 bg-black shadow-[0_6px_20px_rgba(0,0,0,0.8)]">
                  <div className="relative aspect-video">
                    {poster ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={poster}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-ph-panel">
                        <Play className="h-6 w-6 text-white/40" />
                      </div>
                    )}
                    <span className="absolute inset-x-0 bottom-0 bg-black/80 px-1 py-0.5 text-center font-display text-[10px] font-bold tabular-nums text-white">
                      {formatDuration(hoverPct * duration)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Czas całkowity */}
          <span className="hidden w-9 shrink-0 text-center font-display text-[11px] font-semibold tabular-nums text-white/80 sm:block">
            {formatDuration(duration)}
          </span>

          {/* Głośność */}
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

          {/* Jakość */}
          <span
            title="Materiał w jakości HD"
            className="hidden shrink-0 rounded-[2px] bg-ph-orange px-1 py-[1px] font-display text-[10px] font-black leading-tight text-black sm:block"
          >
            HD
          </span>

          {/* Prędkość odtwarzania */}
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

          {/* Pełny ekran */}
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

      {/* Intro PolHub */}
      {showIntro && (
        <div
          onPointerDown={unmuteIntro}
          className={`absolute inset-0 z-40 overflow-hidden bg-black transition-opacity duration-[400ms] ${
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
            aria-label="Intro PolHub"
          />

          {introMuted && (
            <p className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-[3px] bg-black/70 px-2 py-1 text-[11px] text-white/85">
              <Volume2 className="h-3.5 w-3.5" /> kliknij, aby włączyć dźwięk
            </p>
          )}

          <div className="absolute bottom-3 right-3 flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleFullscreen();
              }}
              aria-label={fullscreen ? "Wyjdź z pełnego ekranu" : "Pełny ekran"}
              className="flex h-8 w-8 items-center justify-center rounded-[3px] bg-black/70 text-white transition-colors hover:bg-ph-orange hover:text-black"
            >
              {fullscreen ? (
                <Minimize className="h-4 w-4" />
              ) : (
                <Maximize className="h-4 w-4" />
              )}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                startVideo();
              }}
              className="flex items-center gap-2 rounded-[3px] bg-black/70 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-white transition-colors hover:bg-ph-orange hover:text-black sm:text-xs"
            >
              Pomiń intro <SkipForward className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
