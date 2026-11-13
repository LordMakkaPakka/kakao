"use client";

/**
 * Elementy „ramki PolHub”: znak serwisu w rogu obrazu i pasek z logo.
 *
 * Znak rysujemy nad obrazem (także nad embedem), więc jest widoczny również
 * w pełnym ekranie. Nie zasłania przycisków serwisu źródłowego — siedzi
 * w prawym górnym rogu i przepuszcza kliknięcia.
 */
export function PolHubWatermark({
  /** Większy znak na starcie intra, mniejszy w czasie filmu. */
  size = "sm",
  className = "",
}: {
  size?: "sm" | "lg";
  className?: string;
}) {
  const big = size === "lg";
  return (
    <div
      aria-hidden
      className={`pointer-events-none select-none ${
        big ? "text-lg sm:text-2xl" : "text-[10px] sm:text-xs"
      } ${className}`}
    >
      <span
        className={`inline-flex items-center rounded-[3px] bg-black/45 font-display font-black tracking-tight text-white/85 backdrop-blur-[2px] ${
          big ? "gap-1 px-2 py-1" : "gap-0.5 px-1.5 py-0.5"
        }`}
      >
        Pol
        <span
          className={`rounded-[2px] bg-ph-orange text-black ${
            big ? "px-1" : "px-0.5"
          }`}
        >
          Hub
        </span>
      </span>
    </div>
  );
}

/** Górny pasek ramki — logo, tytuł filmu i informacja o źródle. */
export function PolHubTopBar({
  title,
  provider,
  uploader,
}: {
  title: string;
  provider?: string;
  uploader?: string;
}) {
  return (
    <div className="flex items-center gap-2 border-b border-ph-border bg-ph-dark px-3 py-2">
      <span className="font-display text-sm font-black tracking-tight text-white">
        Pol
        <span className="ml-0.5 rounded-[3px] bg-ph-orange px-1 py-[1px] text-black">
          Hub
        </span>
      </span>
      <span className="min-w-0 flex-1 truncate text-xs text-ph-muted">
        {uploader ? <span className="text-ph-text">{uploader}</span> : null}
        {uploader ? " · " : null}
        {title}
      </span>
      {provider ? (
        <span className="shrink-0 rounded-full border border-ph-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-ph-muted">
          {provider}
        </span>
      ) : null}
    </div>
  );
}
