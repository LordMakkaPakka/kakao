import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  ArrowLeft,
  CalendarDays,
  Eye,
  Film,
  Heart,
  PencilLine,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { getProfile } from "@/lib/profile";
import { getSessionUser } from "@/lib/auth";
import { getSubscribeState } from "@/lib/subscriptions";
import VideoCard from "@/components/VideoCard";
import VerifiedBadge from "@/components/VerifiedBadge";
import SubscribeButton from "@/components/SubscribeButton";
import { formatViews } from "@/lib/format";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const profile = await getProfile(decodeURIComponent(username));
  if (!profile) return { title: "Nie ma takiego profilu — PolHub" };
  return {
    title: `${profile.username} — profil na PolHub`,
    description:
      profile.bio ??
      `Profil ${profile.username} na PolHub — ${profile.videos.length} filmów.`,
  };
}

export default async function ProfilePage({ params }: Props) {
  const { username } = await params;
  const profile = await getProfile(decodeURIComponent(username));
  if (!profile) notFound();

  const viewer = await getSessionUser();
  const isMine =
    !!viewer && viewer.toLowerCase() === profile.username.toLowerCase();
  const subscribe = await getSubscribeState(profile.username, viewer);

  const joined = profile.createdAt
    ? new Date(profile.createdAt).toLocaleDateString("pl-PL", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <Link
        href="/"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-ph-muted transition-colors hover:text-ph-orange"
      >
        <ArrowLeft className="h-4 w-4" /> Wróć na stronę główną
      </Link>

      {/* Nagłówek profilu */}
      <section className="animate-fade-up overflow-hidden rounded-2xl border border-ph-border bg-ph-dark">
        <div className="h-24 w-full bg-gradient-to-r from-ph-orange/25 via-ph-panel to-ph-black" />
        <div className="px-5 pb-6 sm:px-7">
          <div className="-mt-12 flex flex-wrap items-end gap-4">
            <span className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full bg-ph-orange font-display text-3xl font-black text-black ring-4 ring-ph-dark">
              {profile.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/avatar/${encodeURIComponent(profile.username)}`}
                  alt={profile.username}
                  className="h-full w-full object-cover"
                />
              ) : (
                profile.username.charAt(0).toUpperCase()
              )}
            </span>

            <div className="min-w-0 flex-1 pb-1">
              <h1 className="flex flex-wrap items-center gap-2 font-display text-2xl font-black text-white sm:text-3xl">
                {profile.username}
                {profile.verified && <VerifiedBadge className="h-5 w-5" />}
                {profile.sensei && (
                  <span className="rounded bg-ph-orange px-1.5 py-0.5 text-[10px] font-black uppercase text-black">
                    super admin
                  </span>
                )}
                {!profile.sensei && profile.admin && (
                  <span className="rounded bg-white/15 px-1.5 py-0.5 text-[10px] font-black uppercase text-white">
                    admin
                  </span>
                )}
              </h1>
              <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ph-muted">
                {joined && (
                  <span className="flex items-center gap-1">
                    <CalendarDays className="h-3.5 w-3.5" /> na PolHub od {joined}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Film className="h-3.5 w-3.5" /> {profile.videos.length} filmów
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" /> {subscribe.subscribers}{" "}
                  {subscribe.subscribers === 1 ? "subskrybent" : "subskrybentów"}
                </span>
                <span className="flex items-center gap-1">
                  <Eye className="h-3.5 w-3.5" /> {formatViews(profile.totalViews)}{" "}
                  wyświetleń
                </span>
                <span className="flex items-center gap-1">
                  <Heart className="h-3.5 w-3.5" /> {formatViews(profile.totalLikes)}{" "}
                  polubień
                </span>
              </p>
            </div>

            <div className="ml-auto flex flex-wrap items-center gap-2 pb-1">
              <SubscribeButton
                channel={profile.username}
                initialSubscribed={subscribe.subscribed}
                initialSubscribers={subscribe.subscribers}
                viewer={viewer}
                size="lg"
              />
              {isMine && (
                <Link
                  href="/account"
                  className="flex items-center gap-2 rounded-full border border-ph-border px-5 py-2 text-sm font-semibold text-white transition-colors hover:border-ph-orange hover:text-ph-orange"
                >
                  <PencilLine className="h-4 w-4" /> Edytuj profil
                </Link>
              )}
            </div>
          </div>

          {/* Opis */}
          <div className="mt-5 rounded-xl border border-ph-border bg-black/30 p-4">
            <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ph-muted">
              <Sparkles className="h-3.5 w-3.5" /> O mnie
            </p>
            {profile.bio ? (
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-ph-text">
                {profile.bio}
              </p>
            ) : (
              <p className="text-sm text-ph-muted">
                {isMine
                  ? "Nie masz jeszcze opisu profilu — dodaj go w „Moje konto”, żeby inni wiedzieli, co wrzucasz."
                  : `${profile.username} nie dodał jeszcze opisu profilu.`}
              </p>
            )}
          </div>

          {!profile.registered && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-ph-muted">
              <ShieldCheck className="h-3.5 w-3.5 text-[#4db5f5]" />
              To konto z listy startowej PolHub — odznaka nadana przez redakcję.
            </p>
          )}
        </div>
      </section>

      {/* Filmy */}
      <section className="mt-8">
        <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-extrabold text-white">
          <Film className="h-5 w-5 text-ph-orange" /> Filmy{" "}
          <span className="text-ph-orange">({profile.videos.length})</span>
        </h2>

        {profile.videos.length > 0 ? (
          <div className="grid grid-cols-1 gap-x-4 gap-y-7 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {profile.videos.map((v, i) => (
              <VideoCard key={v.id} video={v} index={i} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-ph-border bg-ph-dark p-10 text-center">
            <Film className="mx-auto h-9 w-9 text-ph-border" />
            <p className="mt-3 font-display text-lg font-bold text-white">
              Pusto jak zawsze
            </p>
            <p className="mt-1 text-sm text-ph-muted">
              {isMine
                ? "Nie masz jeszcze żadnego filmu."
                : `${profile.username} nie wrzucił jeszcze żadnego filmu.`}
            </p>
            {isMine && (
              <Link
                href="/upload"
                className="mt-4 inline-block rounded-full bg-ph-orange px-5 py-2 text-sm font-bold text-black transition-colors hover:bg-ph-orange-hover"
              >
                Prześlij film
              </Link>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
