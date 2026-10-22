"use client";

import { useState } from "react";
import { ThumbsUp, ThumbsDown, Share2, Flag, Check } from "lucide-react";
import { ratingPercent } from "@/lib/format";

export default function WatchActions({
  videoId,
  initialLikes,
  initialDislikes,
}: {
  videoId: number;
  initialLikes: number;
  initialDislikes: number;
}) {
  const [likes, setLikes] = useState(initialLikes);
  const [dislikes, setDislikes] = useState(initialDislikes);
  const [vote, setVote] = useState<"like" | "dislike" | null>(null);
  const [copied, setCopied] = useState(false);

  async function react(type: "like" | "dislike") {
    if (vote) return;
    setVote(type);
    try {
      const res = await fetch(`/api/videos/${videoId}/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      if (res.ok) {
        const data = await res.json();
        setLikes(data.likes);
        setDislikes(data.dislikes);
      }
    } catch {
      setVote(null);
    }
  }

  async function share() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  const rating = ratingPercent(likes, dislikes);

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => react("like")}
          disabled={vote !== null}
          className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition-all ${
            vote === "like"
              ? "bg-green-500 text-black"
              : "bg-ph-panel text-white hover:bg-green-500/20 hover:text-green-400"
          } disabled:cursor-default`}
        >
          <ThumbsUp className="h-4 w-4" /> {likes}
        </button>
        <button
          onClick={() => react("dislike")}
          disabled={vote !== null}
          className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition-all ${
            vote === "dislike"
              ? "bg-red-500 text-black"
              : "bg-ph-panel text-white hover:bg-red-500/20 hover:text-red-400"
          } disabled:cursor-default`}
        >
          <ThumbsDown className="h-4 w-4" /> {dislikes}
        </button>
        <button
          onClick={share}
          className="flex items-center gap-2 rounded-full bg-ph-panel px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-ph-border"
        >
          {copied ? <Check className="h-4 w-4 text-green-400" /> : <Share2 className="h-4 w-4" />}
          {copied ? "Skopiowano!" : "Udostępnij"}
        </button>
        <button className="flex items-center gap-2 rounded-full bg-ph-panel px-5 py-2.5 text-sm font-bold text-ph-muted transition-colors hover:bg-ph-border hover:text-white">
          <Flag className="h-4 w-4" /> Zgłoś
        </button>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-red-500/60">
          <div
            className="h-full rounded-full bg-green-500 transition-all duration-500"
            style={{ width: `${rating}%` }}
          />
        </div>
        <span className="text-xs font-bold text-ph-muted">{rating}% pozytywnych ocen</span>
      </div>
    </div>
  );
}