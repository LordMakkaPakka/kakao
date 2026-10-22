export const CATEGORIES = [
  "Wszystkie",
  "Amatorskie",
  "HD",
  "Popularne",
  "Zwierzaki",
  "Gotowanie",
  "Gaming",
  "Sport",
  "Muzyka",
  "Komedia",
  "Nauka",
  "Vlogi",
] as const;

export function formatViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".", ",")} mln`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(".", ",")} tys.`;
  return `${n}`;
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? h + ":" : ""}${mm}:${String(sec).padStart(2, "0")}`;
}

export function timeAgo(date: Date): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "przed chwilą";
  if (mins < 60) return `${mins} min temu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} godz. temu`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} dni temu`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} mies. temu`;
  return `${Math.floor(months / 12)} lat temu`;
}

export function ratingPercent(likes: number, dislikes: number): number {
  const total = likes + dislikes;
  if (total === 0) return 100;
  return Math.round((likes / total) * 100);
}