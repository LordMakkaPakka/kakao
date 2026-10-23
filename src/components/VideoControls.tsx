"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  Volume1,
  VolumeX,
  Maximize,
  Minimize,
  Clapperboard,
} from "lucide-react";

const HIDE_DELAY_MS = 2500;

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

type WebkitVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void };

export default function VideoControls({
  videoRef,
  containerRef,
  onReplayIntro,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  containerRef: RefObject<HTMLDivElement | null>;
  onReplayIntro: () => void;
}) {
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [visible, setVisible] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);
  const [hoverPct, setHoverPct] = useState<number | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const scheduleHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setVisible(true);
    hideTimer.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) setVisible(false);
    }, HIDE_DELAY_MS);
  }, [videoRef]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const sync = () => {
      setPlaying(!v.paused);
      setCurrent(v.currentTime);
      setDuration(v.duration || 0);
      setVolume(v.volume);
      setMuted(v.muted);
      if (v.buffered.length) setBuffered(v.buffered.end(v.buffered.length - 1));
    };
    const onPause = () => {
      sync();
      setVisible(true);
    };
    const events = ["timeupdate", "loadedmetadata", "durationchange", "progress", "volumechange", "play"];
    events.forEach((e) => v.addEventListener(e, sync));
    v.addEventListener("pause", onPause);
    v.addEventListener("ended", onPause);
    sync();
    return () => {
      events.forEach((e) => v.removeEventListener(e, sync));
      v.removeEventListener("pause", onPause);
      v.removeEventListener("ended", onPause);
    };
  }, [videoRef]);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [containerRef]);

  useEffect(() => () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
    scheduleHide();
  }, [videoRef, scheduleHide]);

  const seekBy = useCallback(
    (delta: number) => {
      const v = videoRef.current;
      if (!v) return;
      v.currentTime = Math.min(Math.max(v.currentTime + delta, 0), v.duration || 0);
      scheduleHide();
    },
    [videoRef, scheduleHide],
  );

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    if (!v.muted && v.volume === 0) v.volume = 0.5;
  }, [videoRef]);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    const v = videoRef.current as WebkitVideo | null;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else if (el?.requestFullscreen) {
      el.requestFullscreen().catch(() => v?.webkitEnterFullscreen?.());
    } else {
      v?.webkitEnterFullscreen?.();
    }
  }, [containerRef, videoRef]);

  const pctFromEvent = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    return Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
  };

  const seekToPct = (pct: number) => {
    const v = videoRef.current;
    if (v && duration) v.currentTime = pct * duration;
    setCurrent(pct * duration);
  };

  const onTrackPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setScrubbing(true);
    seekToPct(pctFromEvent(e.clientX));
  };

  const onTrackPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const pct = pctFromEvent(e.clientX);
    setHoverPct(pct);
    if (scrubbing) seekToPct(pct);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const key = e.key.toLowerCase();
    if (key === " " || key === "k") togglePlay();
    else if (key === "arrowright" || key === "l") seekBy(key === "l" ? 10 : 5);
    else if (key === "arrowleft" || key === "j") seekBy(key === "j" ? -10 : -5);
    else if (key === "m") toggleMute();
    else if (key === "f") toggleFullscreen();
    else return;
    e.preventDefault();
  };

  const progressPct = duration ? (current / duration) * 100 : 0;
  const bufferedPct = duration ? (buffered / duration) * 100 : 0;
  const effectiveVolume = muted ? 0 : volume;
  const VolumeIcon = effectiveVolume === 0 ? VolumeX : effectiveVolume < 0.5 ? Volume1 : Volume2;
  const shown = visible || !playing || scrubbing;

  return (
    <div
      tabIndex={0}
      role="group"
      aria-label="Odtwarzacz wideo"
      onKeyDown={onKeyDown}
      onPointerMove={scheduleHide}
      onPointerLeave={() => playing && !scrubbing && setVisible(false)}
      className={`absolute inset-0 z-[5] outline-none ${shown ? "cursor-default" : "cursor-none"}`}
    >
      <button
        type="button"
        aria-label={playing ? "Pauza" : "Odtwórz"}
        onClick={togglePlay}
        onDoubleClick={toggleFullscreen}
        className="absolute inset-0 h-full w-full"
      />

      {!playing && (
        <button
          type="button"
          onClick={togglePlay}
          aria-label="Odtwórz"
          className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-ph-orange text-black shadow-[0_0_40px_rgba(255,153,0,0.45)] transition-transform hover:scale-110 sm:h-20 sm:w-20"
        >
          <Play className="ml-1 h-7 w-7 fill-current sm:h-9 sm:w-9" />
        </button>
      )}

      <div
        className={`pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-3 pb-2 pt-12 transition-opacity duration-300 sm:px-4 sm:pb-3 ${
          shown ? "opacity-100" : "opacity-0"
        }`}
      >
        <div
          ref={trackRef}
          role="slider"
          aria-label="Postęp"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(current)}
          aria-valuetext={`${formatTime(current)} z ${formatTime(duration)}`}
          onPointerDown={onTrackPointerDown}
          onPointerMove={onTrackPointerMove}
          onPointerUp={() => setScrubbing(false)}
          onPointerLeave={() => setHoverPct(null)}
          className={`group/track relative flex h-4 cursor-pointer touch-none items-center ${
            shown ? "pointer-events-auto" : ""
          }`}
        >
          <div className="relative h-1 w-full overflow-hidden rounded-full bg-white/20 transition-[height] group-hover/track:h-1.5">
            <div className="absolute inset-y-0 left-0 bg-white/30" style={{ width: `${bufferedPct}%` }} />
            {hoverPct !== null && (
              <div className="absolute inset-y-0 left-0 bg-white/20" style={{ width: `${hoverPct * 100}%` }} />
            )}
            <div className="absolute inset-y-0 left-0 bg-ph-orange" style={{ width: `${progressPct}%` }} />
          </div>
          <span
            className={`absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ph-orange shadow-md ring-2 ring-black/40 transition-transform ${
              scrubbing ? "scale-110" : "scale-0 group-hover/track:scale-100"
            }`}
            style={{ left: `${progressPct}%` }}
          />
          {hoverPct !== null && duration > 0 && (
            <span
              className="absolute -top-7 -translate-x-1/2 rounded bg-black/85 px-1.5 py-0.5 font-mono text-[11px] text-white"
              style={{ left: `${hoverPct * 100}%` }}
            >
              {formatTime(hoverPct * duration)}
            </span>
          )}
        </div>

        <div className={`mt-1 flex items-center gap-1 text-white sm:gap-2 ${shown ? "pointer-events-auto" : ""}`}>
          <ControlButton label={playing ? "Pauza (k)" : "Odtwórz (k)"} onClick={togglePlay}>
            {playing ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
          </ControlButton>
          <ControlButton label="Cofnij 10 s (j)" onClick={() => seekBy(-10)}>
            <RotateCcw className="h-[18px] w-[18px]" />
          </ControlButton>
          <ControlButton label="Do przodu 10 s (l)" onClick={() => seekBy(10)}>
            <RotateCw className="h-[18px] w-[18px]" />
          </ControlButton>

          <div className="group/vol flex items-center">
            <ControlButton label={muted ? "Włącz dźwięk (m)" : "Wycisz (m)"} onClick={toggleMute}>
              <VolumeIcon className="h-5 w-5" />
            </ControlButton>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={effectiveVolume}
              aria-label="Głośność"
              onChange={(e) => {
                const v = videoRef.current;
                if (!v) return;
                v.volume = Number(e.target.value);
                v.muted = v.volume === 0;
              }}
              style={{ backgroundSize: `${effectiveVolume * 100}% 100%` }}
              className="ph-volume hidden w-0 opacity-0 transition-all duration-200 group-hover/vol:w-20 group-hover/vol:opacity-100 focus-visible:w-20 focus-visible:opacity-100 sm:block"
            />
          </div>

          <span className="ml-1 font-mono text-xs tabular-nums text-white/90 sm:text-[13px]">
            {formatTime(current)}
            <span className="text-white/45"> / {formatTime(duration)}</span>
          </span>

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <ControlButton label="Odtwórz intro ponownie" onClick={onReplayIntro}>
              <Clapperboard className="h-[18px] w-[18px]" />
            </ControlButton>
            <span
              aria-hidden="true"
              className="hidden select-none items-center font-display text-sm font-black tracking-tight sm:flex"
            >
              Pol<span className="ml-0.5 rounded-[3px] bg-ph-orange px-1 text-black">Hub</span>
            </span>
            <ControlButton label={fullscreen ? "Zamknij pełny ekran (f)" : "Pełny ekran (f)"} onClick={toggleFullscreen}>
              {fullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
            </ControlButton>
          </div>
        </div>
      </div>
    </div>
  );
}

function ControlButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-9 w-9 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/10 hover:text-ph-orange focus-visible:outline-2 focus-visible:outline-ph-orange"
    >
      {children}
    </button>
  );
}
