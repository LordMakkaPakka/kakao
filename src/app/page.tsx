import Link from "next/link";
import { and, desc, eq, ilike } from "drizzle-orm";
import { db } from "@/db";
import { videos } from "@/db/schema";
import CategoryBar from "@/components/CategoryBar";
import VideoCard from "@/components/VideoCard";
import { getSessionUser } from "@/lib/auth";
import { ensureSchema } from "@/lib/dbInit";
import { UploadCloud, Clapperboard, TvMinimalPlay, Lock, UserPlus } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cat?: string }>;
}) {
  const { q, cat } = await searchParams;
  await ensureSchema();
  const user = await getSessionUser();
  const activeCat = cat ?? "Wszystkie";

  const conditions = [];
  if (q?.trim()) conditions.push(ilike(videos.title, `%${q.trim()}%`));
  if (cat && cat !== "Wszystkie" && cat !== "Popularne")
    conditions.push(eq(videos.category, cat));

  const rows = await db
    .select({
      id: videos.id,
      title: videos.title,
      category: videos.category,
      uploader: videos.uploader,
      durationSeconds: videos.durationSeconds,
      thumbnail: videos.thumbnail,
      views: videos.views,
      likes: videos.likes,
      dislikes: videos.dislikes,
      createdAt: videos.createdAt,
    })
    .from(videos)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(cat === "Popularne" ? desc(videos.views) : desc(videos.createdAt))
    .limit(48);

  return (
    <>
      <CategoryBar active={activeCat} q={q} />

      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* Section heading */}
        <div className="mb-5 flex items-end justify-between">
          <div>
            <h1 className="font-display text-xl font-extrabold text-white sm:text-2xl">
              {q?.trim() ? (
                <>
                  Wyniki dla: <span className="text-ph-orange">„{q.trim()}”</span>
                </>
              ) : cat === "Popularne" ? (
                <>
                  Najpopularniejsze <span className="text-ph-orange">filmy</span>
                </>
              ) : (
                <>
                  Polecane <span className="text-ph-orange">filmy</span>{" "}
                  <span className="text-sm font-semibold text-ph-muted">
                    – dziś w Polsce
                  </span>
                </>
              )}
            </h1>
            <p className="mt-1 text-sm text-ph-muted">
              {rows.length === 0
                ? "0 filmów • cisza jak w bibliotece"
                : `${rows.length} ${rows.length === 1 ? "film" : "filmów"} • świeżo wrzucone`}
            </p>
          </div>
          <Link
            href="/upload"
            className="hidden items-center gap-2 text-sm font-semibold text-ph-orange transition-colors hover:text-ph-orange-hover sm:flex"
          >
            <UploadCloud className="h-4 w-4" /> Wrzuć pierwszy film
          </Link>
        </div>

        {rows.length > 0 ? (
          <div className="grid grid-cols-1 gap-x-4 gap-y-7 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {rows.map((v, i) => (
              <VideoCard key={v.id} video={v} index={i} />
            ))}
          </div>
        ) : (
          <EmptyState hasFilter={Boolean(q?.trim() || (cat && cat !== "Wszystkie"))} loggedIn={Boolean(user)} />
        )}
      </div>
    </>
  );
}

function EmptyState({
  hasFilter,
  loggedIn,
}: {
  hasFilter: boolean;
  loggedIn: boolean;
}) {
  return (
    <div className="animate-fade-up relative overflow-hidden rounded-2xl border border-ph-border bg-gradient-to-b from-ph-dark to-black px-6 py-16 text-center sm:py-24">
      {/* decorative glow */}
      <div className="pointer-events-none absolute -top-24 left-1/2 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-ph-orange/10 blur-3xl" />

      <div className="relative mx-auto flex max-w-xl flex-col items-center">
        <div className="animate-pulse-glow relative flex h-24 w-24 items-center justify-center rounded-2xl border border-ph-border bg-ph-panel">
          <TvMinimalPlay className="h-12 w-12 text-ph-orange" />
          <span className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-ph-orange font-display text-xs font-black text-black">
            0
          </span>
        </div>

        <h2 className="mt-8 font-display text-3xl font-black text-white sm:text-4xl">
          Narazie nic tu nie ma
        </h2>
        <p className="mt-3 text-base leading-relaxed text-ph-muted">
          {hasFilter
            ? "Żaden film nie pasuje do Twojego wyszukiwania. Ale spokojnie – na tej stronie i tak prawie nic nie ma."
            : "PolHub jest oficjalnie najczystszym serwisem wideo w Polsce. Zero filmów, zero problemów. Załóż konto albo się zaloguj i wrzuć pierwszy materiał!"}
        </p>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
          <Link
            href="/upload"
            className="flex items-center gap-2 rounded-full bg-ph-orange px-7 py-3 font-display text-sm font-black uppercase tracking-wide text-black transition-all hover:bg-ph-orange-hover hover:shadow-[0_0_24px_rgba(255,144,0,0.45)]"
          >
            <UploadCloud className="h-5 w-5" /> Prześlij film
          </Link>
          {!loggedIn && (
            <>
              <Link
                href="/login"
                className="flex items-center gap-2 rounded-full border border-ph-border px-7 py-3 text-sm font-bold text-white transition-colors hover:border-ph-orange hover:text-ph-orange"
              >
                <Lock className="h-4 w-4" /> Zaloguj się
              </Link>
              <Link
                href="/register"
                className="flex items-center gap-2 rounded-full border border-ph-border px-7 py-3 text-sm font-bold text-white transition-colors hover:border-ph-orange hover:text-ph-orange"
              >
                <UserPlus className="h-4 w-4" /> Zarejestruj się
              </Link>
            </>
          )}
        </div>

        <div className="mt-12 grid w-full grid-cols-3 gap-3 border-t border-ph-border pt-8">
          {[
            { n: "0", label: "filmów" },
            { n: "0", label: "problemów" },
            { n: "∞", label: "możliwości" },
          ].map((s) => (
            <div key={s.label}>
              <p className="font-display text-2xl font-black text-ph-orange sm:text-3xl">
                {s.n}
              </p>
              <p className="mt-1 flex items-center justify-center gap-1 text-xs text-ph-muted">
                <Clapperboard className="h-3 w-3" /> {s.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}