import Link from "next/link";
import { Eye, ThumbsUp, Play, Film } from "lucide-react";
import {
  formatDuration,
  formatViews,
  ratingPercent,
  timeAgo,
} from "@/lib/format";
import VerifiedBadge from "@/components/VerifiedBadge";

export type VideoCardData = {
  id: number;
  title: string;
  category: string;
  uploader: string;
  /** Czy uploader ma odznakę weryfikacji (liczone na serwerze). */
  uploaderVerified?: boolean;
  durationSeconds: number;
  thumbnail: string | null;
  views: number;
  likes: number;
  dislikes: number;
  createdAt: Date;
};

export default function VideoCard({
  video,
  index = 0,
}: {
  video: VideoCardData;
  index?: number;
}) {
  const rating = ratingPercent(video.likes, video.dislikes);

  return (
    <Link
      href={`/watch/${video.id}`}
      className="group animate-fade-up block"
      style={{ animationDelay: `${Math.min(index, 11) * 45}ms` }}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video overflow-hidden rounded-md bg-ph-panel ring-1 ring-ph-border transition-all group-hover:ring-2 group-hover:ring-ph-orange">
        {video.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={video.thumbnail}
            alt={video.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-ph-panel to-black">
            <Film className="h-10 w-10 text-ph-border" />
          </div>
        )}

        {/* hover play overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/40">
          <span className="flex h-12 w-12 scale-75 items-center justify-center rounded-full bg-ph-orange opacity-0 transition-all duration-200 group-hover:scale-100 group-hover:opacity-100">
            <Play className="ml-0.5 h-6 w-6 fill-black text-black" />
          </span>
        </div>

        {/* badges */}
        <span className="absolute bottom-1.5 right-1.5 rounded bg-black/85 px-1.5 py-0.5 font-display text-xs font-bold text-white">
          {formatDuration(video.durationSeconds)}
        </span>
        <span className="absolute left-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-ph-muted">
          {video.category}
        </span>
      </div>

      {/* Meta */}
      <div className="mt-2 px-0.5">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-white transition-colors group-hover:text-ph-orange">
          {video.title}
        </h3>
        <p className="mt-1 flex items-center gap-1 text-xs text-ph-muted">
          {video.uploader}
          {video.uploaderVerified === true && (
            <VerifiedBadge className="h-3.5 w-3.5" />
          )}
        </p>
        <div className="mt-1 flex items-center gap-3 text-xs text-ph-muted">
          <span className="flex items-center gap-1">
            <Eye className="h-3.5 w-3.5" /> {formatViews(video.views)} wyświetleń
          </span>
          <span className="flex items-center gap-1">
            <ThumbsUp className="h-3.5 w-3.5" /> {rating}%
          </span>
          <span>{timeAgo(video.createdAt)}</span>
        </div>
        {/* rating bar */}
        <div className="mt-1.5 h-[3px] w-full overflow-hidden rounded-full bg-ph-border">
          <div
            className="h-full rounded-full bg-gradient-to-r from-green-500 to-green-400"
            style={{ width: `${rating}%` }}
          />
        </div>
      </div>
    </Link>
  );
}