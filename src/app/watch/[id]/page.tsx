import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, ne, sql, desc } from "drizzle-orm";
import { db } from "@/db";
import { users, videos } from "@/db/schema";
import { isVerified } from "@/lib/verified";
import VideoCard from "@/components/VideoCard";
import WatchActions from "@/components/WatchActions";
import IntroPlayer from "@/components/IntroPlayer";
import CategoryBar from "@/components/CategoryBar";
import { formatViews, timeAgo } from "@/lib/format";
import { ensureSchema } from "@/lib/dbInit";
import { Eye, BadgeCheck, CalendarDays, HardDrive, ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function WatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const videoId = Number(id);
  if (!Number.isInteger(videoId)) notFound();
  await ensureSchema();

  const [video] = await db
    .update(videos)
    .set({ views: sql`${videos.views} + 1` })
    .where(eq(videos.id, videoId))
    .returning({
      id: videos.id,
      title: videos.title,
      description: videos.description,
      category: videos.category,
      uploader: videos.uploader,
      fileSize: videos.fileSize,
      thumbnail: videos.thumbnail,
      views: videos.views,
      likes: videos.likes,
      dislikes: videos.dislikes,
      createdAt: videos.createdAt,
    });

  if (!video) notFound();

  const [uploaderRow] = await db
    .select({ avatar: users.avatar })
    .from(users)
    .where(eq(users.username, video.uploader))
    .limit(1);
  const uploaderAvatar = uploaderRow?.avatar ?? null;
  const verified = isVerified(video.uploader);

  const related = await db
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
    .where(ne(videos.id, videoId))
    .orderBy(desc(videos.createdAt))
    .limit(8);

  return (
    <>
      <CategoryBar active={video.category} />
      <div className="mx-auto max-w-7xl px-4 py-6">
        <Link
          href="/"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-ph-muted transition-colors hover:text-ph-orange"
        >
          <ArrowLeft className="h-4 w-4" /> Wróć na stronę główną
        </Link>

        <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
          {/* Player + info */}
          <div className="animate-fade-up min-w-0">
            <IntroPlayer
              src={`/api/videos/${video.id}/file`}
              poster={video.thumbnail}
              title={video.title}
              uploader={video.uploader}
            />
            <p className="mt-2 flex items-center gap-1.5 text-xs text-ph-muted">
              <span className="inline-block h-2 w-2 rounded-sm bg-ph-orange" />
              Intro PolHub dodawane automatycznie do każdego filmu
            </p>

            <h1 className="mt-4 font-display text-xl font-extrabold leading-snug text-white sm:text-2xl">
              {video.title}
            </h1>

            <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ph-muted">
              <span className="flex items-center gap-1.5">
                <Eye className="h-4 w-4" /> {formatViews(video.views)} wyświetleń
              </span>
              <span className="flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4" /> {timeAgo(video.createdAt)}
              </span>
              <span className="flex items-center gap-1.5">
                <HardDrive className="h-4 w-4" />
                {(video.fileSize / (1024 * 1024)).toFixed(1)} MB
              </span>
              <Link
                href={`/?cat=${encodeURIComponent(video.category)}`}
                className="rounded-full bg-ph-panel px-3 py-1 text-xs font-semibold text-ph-orange transition-colors hover:bg-ph-orange hover:text-black"
              >
                {video.category}
              </Link>
            </div>

            <WatchActions
              videoId={video.id}
              initialLikes={video.likes}
              initialDislikes={video.dislikes}
            />

            {/* Uploader + description */}
            <div className="mt-5 rounded-xl border border-ph-border bg-ph-dark p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-ph-orange font-display text-lg font-black text-black">
                  {uploaderAvatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={uploaderAvatar} alt={video.uploader} className="h-full w-full object-cover" />
                  ) : (
                    video.uploader.charAt(0)
                  )}
                </span>
                <div>
                  <p className="flex items-center gap-1.5 font-display font-bold text-white">
                    {video.uploader}{" "}
                    {verified && <BadgeCheck className="h-4 w-4 text-ph-orange" />}
                  </p>
                  <p className="text-xs text-ph-muted">
                    {verified ? "Zweryfikowany twórca PolHub" : "Twórca PolHub"}
                  </p>
                </div>
                <button className="ml-auto rounded-full bg-ph-orange px-5 py-2 text-sm font-bold text-black transition-all hover:bg-ph-orange-hover">
                  Subskrybuj
                </button>
              </div>
              {video.description && (
                <p className="mt-4 whitespace-pre-wrap border-t border-ph-border pt-4 text-sm leading-relaxed text-ph-text">
                  {video.description}
                </p>
              )}
            </div>
          </div>

          {/* Related */}
          <aside>
            <h2 className="mb-4 font-display text-lg font-extrabold text-white">
              Następne <span className="text-ph-orange">filmy</span>
            </h2>
            {related.length > 0 ? (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-1">
                {related.map((v, i) => (
                  <VideoCard key={v.id} video={v} index={i} />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-ph-border bg-ph-dark p-8 text-center">
                <p className="font-display font-bold text-white">Pusto jak zawsze</p>
                <p className="mt-2 text-sm text-ph-muted">
                  To jedyny film na całym PolHub. Wrzuć kolejny!
                </p>
                <Link
                  href="/upload"
                  className="mt-4 inline-block rounded-full bg-ph-orange px-5 py-2 text-sm font-bold text-black transition-colors hover:bg-ph-orange-hover"
                >
                  Prześlij film
                </Link>
              </div>
            )}
          </aside>
        </div>
      </div>
    </>
  );
}
