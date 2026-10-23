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
 * Intro PolHub jest częścią każdego filmu – leci jako pierwszy fragment
 * (jedna oś czasu, jedno okno), a po nim film startuje automatycznie,
 * bez zatrzymania. Intro zawsze idzie z dźwiękiem.
 */
const INTRO_SRC = "/intro.mov";
const HIDE_CONTROLS_MS = 2600;
const INTRO_FADE_MS = 320;

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
  const introRef = useRef<HTMLVideoElement>(null);
  const mainRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draggingRef = useRef(false);
  const wantsPlayRef = useRef(true);
  const pendingIntroSeekRef = useRef<number | null>(null);
  const volumeRef = useRef(1);
  const mutedRef = useRef(false);
  const rateRef = useRef(1);

  const [phase, setPhase] = useState<Phase>("intro");
  // Ref trzyma aktualną fazę natychmiast – handlery zdarzeń nie mogą
  // czytać stanu, bo React aktualizuje go dopiero po przerysowaniu.
  const phaseRef = useRef<Phase>("intro");
  const [introMounted, setIntroMounted] = useState(true);
  const [introFading, setIntroFading] = useState(false);
  const [introDuration, setIntroDuration] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [introBroken, setIntroBroken] = useState(false);

  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [needsGesture, setNeedsGesture] = useState(false);
  // Czy pierwsza próba startu już się rozstrzygnęła (żeby nie mrugał play).
  const [started, setStarted] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [introTime, setIntroTime] = useState(0);
  const [videoTime, setVideoTime] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [hoverPct, setHoverPct] = useState<number | null>(null);
  const [rate, setRate] = useState(1);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const active = useCallback(
    () => (phase === "intro" ? introRef.current : mainRef.current),
    [phase]
  );

  const changePhase = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);
  const introLen = introBroken ? 0 : introDuration;
  const total = introLen + videoDuration;
  const position = phase === "intro" ? introTime : introLen + videoTime;
  const progress = total > 0 ? Math.min(1, Math.max(0, position / total)) : 0;
  const bufferedPos = phase === "intro" ? buffered : introLen + buffered;
  const bufferedPct =
    total > 0 ? Math.min(1, Math.max(0, bufferedPos / total)) : 0;
  const hoverClamped =
    hoverPct === null ? 0 : Math.min(Math.max(hoverPct * 100, 7), 93);
  const isIntroPhase = phase === "intro" && !introBroken && introLen > 0;
  const barVisible = controlsVisible || !playing || settingsOpen || ended;
  const VolumeIcon =
    muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  /* ===== Długości obu części osi czasu ===== */

  // Metadane potrafią wczytać się szybciej niż React podepnie handler
  // (szczególnie na szybkim łączu), dlatego długości dosynchronizowujemy
  // także przez krótki polling na referencjach.
  useEffect(() => {
    let ticks = 0;
    const sync = () => {
      ticks += 1;
      const i = introRef.current;
      const m = mainRef.current;
      let done = true;
      if (i && Number.isFinite(i.duration) && i.duration > 0) {
        setIntroDuration(i.duration);
      } else done = false;
      if (m && Number.isFinite(m.duration) && m.duration > 0) {
        setVideoDuration(m.duration);
      } else done = false;
      if (done || ticks > 50) clearInterval(id);
    };
    sync();
    const id = setInterval(sync, 200);
    return () => clearInterval(id);
  }, []);

  /* ===== Pomocnicze: aplikowanie ustawień na oba odtwarzacze ===== */

  const applySettings = useCallback((el: HTMLVideoElement | null) => {
    if (!el) return;
    el.volume = volumeRef.current;
    el.muted = mutedRef.current;
    el.playbackRate = rateRef.current;
  }, []);

  /**
   * Próba odtwarzania z dźwiękiem. Jeśli przeglądarka odmówi
   * (polityka autoplay), odtwarzacz i tak rusza dalej – tylko wyciszony,
   * z wyraźnym przyciskiem do włączenia dźwięku. Film nigdy nie staje.
   */
  const playElement = useCallback(
    (el: HTMLVideoElement | null) => {
      if (!el) return;
      wantsPlayRef.current = true;
      applySettings(el);
      el.play()
        .then(() => {
          setNeedsGesture(false);
          setNowPlaying(title, uploader);
        })
        .catch(() => {
          if (!el.muted) {
            el.muted = true;
            mutedRef.current = true;
            setMuted(true);
          }
          el.play()
            .then(() => {
              setNeedsGesture(true);
              setStarted(true);
              setNowPlaying(title, uploader);
            })
            .catch(() => {
              setNeedsGesture(true);
              setStarted(true);
            });
        });
    },
    [applySettings, title, uploader]
  );

  /* ===== Pełny ekran ===== */

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
      return;
    }
    const el = containerRef.current;
    if (el?.requestFullscreen) {
      el.requestFullscreen().catch(() => {
        (active() as WebkitVideo | null)?.webkitEnterFullscreen?.();
      });
    } else {
      (active() as WebkitVideo | null)?.webkitEnterFullscreen?.();
    }
  }, [active]);

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
      const v = active();
      if (v && !v.paused && !draggingRef.current) setControlsVisible(false);
    }, HIDE_CONTROLS_MS);
  }, [active]);

  useEffect(() => {
    const start = setTimeout(() => {
      const v = active();
      if (v && !v.paused) setControlsVisible(false);
    }, HIDE_CONTROLS_MS);
    return () => {
      clearTimeout(start);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
  }, [active]);

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

  /* ===== Start: intro gra pierwsze, z dźwiękiem ===== */

  useEffect(() => {
    const intro = introRef.current;
    if (intro) playElement(intro);
    // film czeka przygotowany w tle
    const main = mainRef.current;
    if (main) {
      applySettings(main);
      main.load();
    }
  }, [applySettings, playElement]);

  /* ===== Przejście intro → film (bez zatrzymania) ===== */

  const switchToVideo = useCallback(() => {
    const intro = introRef.current;
    const main = mainRef.current;
    // Najpierw przestawiamy fazę (ref), żeby pauza intro nie zgasiła stanu.
    changePhase("video");
    if (intro) intro.pause();
    if (main) {
      if (videoDuration > 0 && main.currentTime >= videoDuration - 0.05) {
        main.currentTime = 0;
      }
      playElement(main);
    }
    wantsPlayRef.current = true;
    setPlaying(true);
    setVideoTime(main?.currentTime ?? 0);
    setIntroFading(true);
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    fadeTimerRef.current = setTimeout(() => setIntroMounted(false), INTRO_FADE_MS);
  }, [playElement, videoDuration, changePhase]);

  /* ===== Szukanie na wspólnej osi czasu ===== */

  const seekToPosition = useCallback(
    (target: number) => {
      if (!total) return;
      const clamped = Math.max(0, Math.min(total, target));
      const nextPhase: Phase =
        introLen > 0 && clamped < introLen ? "intro" : "video";
      const local =
        nextPhase === "intro" ? clamped : Math.max(0, clamped - introLen);
      const intro = introRef.current;
      const main = mainRef.current;

      setEnded(false);
      wantsPlayRef.current = true;

      if (nextPhase === "intro") {
        setIntroFading(false);
        if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
        changePhase("intro");
        setIntroTime(local);
        main?.pause();

        if (!intro) {
          // Intro było już schowane – montujemy je ponownie i ustawiamy czas
          // w onLoadedMetadata (patrz pendingIntroSeekRef).
          pendingIntroSeekRef.current = local;
          applySettings(introRef.current);
          setIntroMounted(true);
          return;
        }
        setIntroMounted(true);
        intro.currentTime = local;
        playElement(intro);
        return;
      }

      // Film – intro chowamy od razu (skoro szukamy dalej na osi czasu).
      if (intro) intro.pause();
      changePhase("video");
      setIntroFading(false);
      setIntroMounted(false);
      if (!main) return;
      main.currentTime = local;
      setVideoTime(local);
      playElement(main);
    },
    [total, introLen, playElement, applySettings, changePhase]
  );

  const togglePlay = useCallback(() => {
    const el = active();
    if (!el) return;
    if (el.paused || el.ended || needsGesture) {
      if (ended) {
        seekToPosition(0);
        return;
      }
      playElement(el);
    } else {
      el.pause();
    }
    pokeControls();
  }, [active, needsGesture, ended, seekToPosition, playElement, pokeControls]);

  const skipIntro = () => {
    if (!introLen) return;
    seekToPosition(introLen + 0.05);
  };

  /* ===== Zdarzenia odtwarzaczy ===== */

  const onIntroMeta = () => {
    const el = introRef.current;
    if (!el) return;
    applySettings(el);
    if (Number.isFinite(el.duration) && el.duration > 0) {
      setIntroDuration(el.duration);
    }
    // Powrót do intro po przewinięciu (intro mogło być już odmontowane).
    if (pendingIntroSeekRef.current !== null) {
      el.currentTime = pendingIntroSeekRef.current;
      setIntroTime(pendingIntroSeekRef.current);
      pendingIntroSeekRef.current = null;
    }
    if (wantsPlayRef.current) playElement(el);
  };

  const onMainMeta = () => {
    const el = mainRef.current;
    if (!el) return;
    applySettings(el);
    if (Number.isFinite(el.duration) && el.duration > 0) {
      setVideoDuration(el.duration);
    }
  };

  const onIntroEnded = () => switchToVideo();

  const onIntroError = () => {
    setIntroBroken(true);
    switchToVideo();
  };

  const onMainEnded = () => {
    setPlaying(false);
    setWaiting(false);
    setEnded(true);
  };

  /* ===== Pasek postępu ===== */

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

  /* ===== Głośność i prędkość ===== */

  const setVolumeTo = (value: number) => {
    const next = Math.min(1, Math.max(0, value));
    volumeRef.current = next;
    mutedRef.current = next === 0;
    for (const el of [introRef.current, mainRef.current]) {
      if (!el) continue;
      el.volume = next;
      el.muted = next === 0;
    }
    setVolume(next);
    setMuted(next === 0);
    if (next > 0) setNeedsGesture(false);
  };

  const toggleMute = () => {
    const nextMuted = !(mutedRef.current || muted);
    mutedRef.current = nextMuted;
    for (const el of [introRef.current, mainRef.current]) {
      if (el) el.muted = nextMuted;
    }
    setMuted(nextMuted);
    if (!nextMuted) {
      setNeedsGesture(false);
      if (volumeRef.current === 0) setVolumeTo(0.6);
    }
  };

  const changeRate = (value: number) => {
    rateRef.current = value;
    for (const el of [introRef.current, mainRef.current]) {
      if (el) el.playbackRate = value;
    }
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

  const onSurfaceClick = (e: ReactMouseEvent<HTMLElement>) => {
    if (e.detail > 1) return;
    containerRef.current?.focus({ preventScroll: true });
    setSettingsOpen(false);
    if (!controlsVisible && playing) {
      pokeControls();
      return;
    }
    togglePlay();
  };

  // Przycisk play pokazujemy tylko, gdy naprawdę trzeba: pauza, koniec filmu
  // albo gdy nie udało się w ogóle wystartować. Gdy intro/film leci (nawet
  // wyciszony z powodu blokady autoplay), wielkie kółko nie zasłania obrazu.
  const showCenterButton = ended || (started && !playing);

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
      {/* Film – zawsze zamontowany i wstępnie wczytany */}
      <video
        ref={mainRef}
        src={src}
        poster={poster ?? undefined}
        playsInline
        preload="auto"
        onLoadedMetadata={onMainMeta}
        onTimeUpdate={(e) => setVideoTime(e.currentTarget.currentTime)}
        onProgress={(e) => {
          const v = e.currentTarget;
          if (phaseRef.current === "video" && v.buffered.length > 0) {
            setBuffered(v.buffered.end(v.buffered.length - 1));
          }
        }}
        onPlay={() => {
          if (phaseRef.current === "video") {
            setPlaying(true);
            setEnded(false);
            setNowPlaying(title, uploader);
          }
        }}
        onPause={() => {
          if (phase === "video") setPlaying(false);
        }}
        onWaiting={() => {
          if (phase === "video") setWaiting(true);
        }}
        onPlaying={() => {
          if (phase === "video") setWaiting(false);
        }}
        onCanPlay={() => {
          if (phase === "video") setWaiting(false);
        }}
        onVolumeChange={(e) => {
          setVolume(e.currentTarget.volume);
          setMuted(e.currentTarget.muted);
        }}
        onEnded={onMainEnded}
        onError={() => setWaiting(false)}
        className="absolute inset-0 h-full w-full bg-black object-contain"
      />

      {/* Intro – gra jako pierwszy fragment, potem płynnie znika */}
      {introMounted && !introBroken && (
        <div
          className={`pointer-events-none absolute inset-0 z-[5] bg-black transition-opacity duration-300 ${
            introFading ? "opacity-0" : "opacity-100"
          }`}
        >
          <video
            ref={introRef}
            src={INTRO_SRC}
            playsInline
            preload="auto"
            onLoadedMetadata={onIntroMeta}
            onTimeUpdate={(e) => setIntroTime(e.currentTarget.currentTime)}
            onProgress={(e) => {
              const v = e.currentTarget;
              if (phaseRef.current === "intro" && v.buffered.length > 0) {
                setBuffered(v.buffered.end(v.buffered.length - 1));
              }
            }}
            onPlay={() => {
              if (phaseRef.current === "intro") {
                setPlaying(true);
                setEnded(false);
                setNowPlaying(title, uploader);
              }
            }}
            onPause={() => {
              if (phaseRef.current === "intro") setPlaying(false);
            }}
            onWaiting={() => {
              if (phaseRef.current === "intro") setWaiting(true);
            }}
            onPlaying={() => {
              if (phaseRef.current === "intro") setWaiting(false);
            }}
            onEnded={onIntroEnded}
            onError={onIntroError}
            className="h-full w-full scale-[1.02] object-cover"
            aria-label="Intro PolHub"
          />
        </div>
      )}

      {/* Warstwa klikalna nad obrazem */}
      <div
        onClick={onSurfaceClick}
        onDoubleClick={toggleFullscreen}
        className="absolute inset-0 z-10"
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
          {needsGesture && !ended && (
            <span className="flex items-center gap-1.5 rounded-[3px] bg-black/70 px-2.5 py-1 text-[11px] font-semibold text-white/90">
              <Volume2 className="h-3.5 w-3.5 text-ph-orange" />
              Kliknij, aby odtworzyć z dźwiękiem
            </span>
          )}
        </button>
      )}

      {/* Szybkie włączenie dźwięku (np. gdy przeglądarka zablokowała autoplay z audio) */}
      {muted && started && !ended && (
        <button
          type="button"
          onClick={toggleMute}
          className="absolute left-3 top-3 z-30 flex items-center gap-1.5 rounded-[3px] bg-black/75 px-2.5 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-ph-orange hover:text-black"
        >
          <VolumeX className="h-3.5 w-3.5" /> Włącz dźwięk
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
