"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
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
  disabled = false,
  children,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  containerRef: RefObject<HTMLDivElement | null>;
  onReplayIntro: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const sync = () => {
      setPlaying(!v.paused && !v.ended);
      setCurrent(v.currentTime);
      setDuration(v.duration || 0);
      setVolume(v.volume);
      setMuted(v.muted);
      if (v.buffered.length) setBuffered(v.buffered.end(v.buffered.length - 1));
    };
    const events = [
      "timeupdate",
      "loadedmetadata",
      "durationchange",
      "progress",
      "volumechange",
      "play",
      "pause",
      "ended",
    ];
    events.forEach((e) => v.addEventListener(e, sync));
    sync();
    return () => events.forEach((e) => v.removeEventListener(e, sync));
  }, [videoRef]);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [containerRef]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v || disabled) return;
    if (v.paused || v.ended) v.play().catch(() => {});
    else v.pause();
  }, [videoRef, disabled]);

  const seekBy = useCallback(
    (delta: number) => {
      const v = videoRef.current;
      if (!v || disabled) return;
      v.currentTime = Math.min(Math.max(v.currentTime + delta, 0), v.duration || 0);
    },
    [videoRef, disabled],
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
    if (!rect || rect.width === 0) return 0;
    return Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
  };

  const seekToPct = (pct: number) => {
    const v = videoRef.current;
    if (!v || !duration || disabled) return;
    v.currentTime = pct * duration;
    setCurrent(pct * duration);
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

  return (
    <div onKeyDown={onKeyDown} className="flex h-full w-full flex-col">
      <div className="relative flex flex-1 items-center justify-center bg-black">
        {children}

        {!disabled && (
          <button
            type="button"
            aria-label={playing ? "Pauza" : "Odtwórz"}
            onClick={togglePlay}
            onDoubleClick={toggleFullscreen}
            className="absolute left-0 top-0 flex h-full w-full items-center justify-center"
          >
            {!playing && (
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-ph-orange text-black shadow-[0_0_40px_rgba(255,153,0,0.45)]">
                <Play className="ml-1 h-7 w-7 fill-current" />
              </span>
            )}
          </button>
        )}
      </div>

      <div
        className={`flex flex-col gap-2 bg-[#141414] px-3 pb-3 pt-3 sm:px-5 ${
          disabled ? "pointer-events-none opacity-40" : ""
        }`}
      >
        <div className="flex items-center gap-3">
          <span className="w-10 shrink-0 font-mono text-xs tabular-nums text-[#e5e5e5]">
            {formatTime(current)}
          </span>
          <div
            ref={trackRef}
            role="slider"
            tabIndex={0}
            aria-label="Postęp"
            aria-valuemin={0}
            aria-valuemax={Math.round(duration)}
            aria-valuenow={Math.round(current)}
            aria-valuetext={`${formatTime(current)} z ${formatTime(duration)}`}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              setScrubbing(true);
              seekToPct(pctFromEvent(e.clientX));
            }}
            onPointerMove={(e) => scrubbing && seekToPct(pctFromEvent(e.clientX))}
            onPointerUp={() => setScrubbing(false)}
            onPointerCancel={() => setScrubbing(false)}
            className="relative flex h-6 flex-1 cursor-pointer touch-none items-center outline-none"
          >
            <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-[#3a3a3a]">
              <div
                className="absolute bottom-0 left-0 top-0 rounded-full bg-[#5a5a5a]"
                style={{ width: `${bufferedPct}%` }}
              />
              <div
                className="absolute bottom-0 left-0 top-0 rounded-full bg-ph-orange"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute h-4 w-4 rounded-full bg-ph-orange shadow-[0_0_0_3px_#141414]"
              style={{ left: `calc(${progressPct}% - 8px)` }}
            />
          </div>
          <span className="w-10 shrink-0 text-right font-mono text-xs tabular-nums text-[#8a8a8a]">
            {formatTime(duration)}
          </span>
        </div>

        <div className="flex items-center">
          <div className="flex flex-1 items-center">
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
              className="ph-volume ml-1 hidden w-20 sm:block"
            />
          </div>

          <div className="flex items-center gap-3">
            <ControlButton label="Cofnij 10 s (j)" onClick={() => seekBy(-10)}>
              <RotateCcw className="h-5 w-5" />
            </ControlButton>
            <button
              type="button"
              onClick={togglePlay}
              aria-label={playing ? "Pauza (k)" : "Odtwórz (k)"}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-ph-orange text-black transition-transform active:scale-95"
            >
              {playing ? (
                <Pause className="h-5 w-5 fill-current" />
              ) : (
                <Play className="ml-0.5 h-5 w-5 fill-current" />
              )}
            </button>
            <ControlButton label="Do przodu 10 s (l)" onClick={() => seekBy(10)}>
              <RotateCw className="h-5 w-5" />
            </ControlButton>
          </div>

          <div className="flex flex-1 items-center justify-end">
            <ControlButton label="Odtwórz intro ponownie" onClick={onReplayIntro}>
              <Clapperboard className="h-5 w-5" />
            </ControlButton>
            <ControlButton
              label={fullscreen ? "Zamknij pełny ekran (f)" : "Pełny ekran (f)"}
              onClick={toggleFullscreen}
            >
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
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-10 w-10 items-center justify-center rounded-full text-[#e5e5e5] transition-colors hover:text-ph-orange active:bg-[#2a2a2a]"
    >
      {children}
    </button>
  );
}
