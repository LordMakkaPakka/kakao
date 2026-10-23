/**
 * Czas trwania banów – moduł bez zależności serwerowych,
 * używany zarówno w API, jak i w komponentach klienckich.
 */
export type BanUnit = "seconds" | "minutes" | "hours" | "days" | "months" | "years";

export const UNIT_MS: Record<BanUnit, number> = {
  seconds: 1000,
  minutes: 60 * 1000,
  hours: 60 * 60 * 1000,
  days: 24 * 60 * 60 * 1000,
  months: 30 * 24 * 60 * 60 * 1000,
  years: 365 * 24 * 60 * 60 * 1000,
};

export const BAN_UNITS: { value: BanUnit; label: string }[] = [
  { value: "seconds", label: "sekund" },
  { value: "minutes", label: "minut" },
  { value: "hours", label: "godzin" },
  { value: "days", label: "dni" },
  { value: "months", label: "miesięcy" },
  { value: "years", label: "lat" },
];

export function durationToMs(value: number, unit: BanUnit): number {
  return Math.max(1000, Math.round(value * UNIT_MS[unit]));
}

/** Ładny opis pozostałego czasu, np. „2 dni 3 godz.”. */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return "0 s";
  const s = Math.floor(ms / 1000);
  const parts: string[] = [];
  const units: [number, string][] = [
    [365 * 24 * 3600, "rok"],
    [30 * 24 * 3600, "mies."],
    [24 * 3600, "dni"],
    [3600, "godz."],
    [60, "min"],
    [1, "s"],
  ];
  let left = s;
  for (const [size, label] of units) {
    const value = Math.floor(left / size);
    if (value > 0) {
      parts.push(`${value} ${label}`);
      left -= value * size;
      if (parts.length === 2) break;
    }
  }
  return parts.join(" ") || "0 s";
}
