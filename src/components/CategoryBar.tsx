import Link from "next/link";
import { CATEGORIES } from "@/lib/format";
import { Flame, Star, Clock, Crown } from "lucide-react";

const ICONS: Record<string, React.ReactNode> = {
  Popularne: <Flame className="h-3.5 w-3.5" />,
  HD: <Star className="h-3.5 w-3.5" />,
  Wszystkie: <Clock className="h-3.5 w-3.5" />,
  Amatorskie: <Crown className="h-3.5 w-3.5" />,
};

export default function CategoryBar({
  active,
  q,
}: {
  active: string;
  q?: string;
}) {
  return (
    <nav
      aria-label="Kategorie"
      className="border-b border-ph-border bg-ph-dark"
    >
      <div className="no-scrollbar mx-auto flex max-w-7xl items-center gap-2 overflow-x-auto px-4 py-2.5">
        {CATEGORIES.map((cat) => {
          const isActive = active === cat;
          const params = new URLSearchParams();
          if (cat !== "Wszystkie") params.set("cat", cat);
          if (q) params.set("q", q);
          const href = `/${params.toString() ? `?${params}` : ""}`;
          return (
            <Link
              key={cat}
              href={href}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-all ${
                isActive
                  ? "bg-ph-orange text-black shadow-[0_0_12px_rgba(255,144,0,0.35)]"
                  : "bg-ph-panel text-ph-muted hover:bg-ph-border hover:text-white"
              }`}
            >
              {ICONS[cat]}
              {cat}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}