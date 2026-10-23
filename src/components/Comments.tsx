"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  Send,
  ThumbsDown,
  ThumbsUp,
  MessageSquare,
  LogIn,
  CornerDownRight,
  Trash2,
} from "lucide-react";
import { authFetch, fetchMe, getToken } from "@/lib/clientAuth";
import { isVerified } from "@/lib/verified";
import VerifiedBadge from "@/components/VerifiedBadge";
import { timeAgo } from "@/lib/format";
import type { CommentItem } from "@/lib/comments";

const MAX_LEN = 1000;

function Avatar({ username, size = 40 }: { username: string; size?: number }) {
  const [broken, setBroken] = useState(false);
  const style = { width: size, height: size };
  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-ph-orange font-display font-black text-black"
      style={{ ...style, fontSize: size * 0.42 }}
    >
      {broken ? (
        username.charAt(0).toUpperCase()
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/avatar/${encodeURIComponent(username)}`}
          alt=""
          width={size}
          height={size}
          onError={() => setBroken(true)}
          className="h-full w-full object-cover"
        />
      )}
    </span>
  );
}

function VoteButtons({
  comment,
  disabled,
  onVote,
}: {
  comment: CommentItem;
  disabled: boolean;
  onVote: (type: "like" | "dislike") => void;
}) {
  return (
    <>
      <button
        type="button"
        onClick={() => onVote("like")}
        disabled={disabled}
        aria-label="Polub komentarz"
        aria-pressed={comment.myVote === "like"}
        className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60 ${
          comment.myVote === "like"
            ? "bg-green-500 text-black"
            : "bg-ph-panel text-ph-muted hover:bg-green-500/15 hover:text-green-400"
        }`}
      >
        <ThumbsUp className="h-3.5 w-3.5" /> {comment.likes}
      </button>
      <button
        type="button"
        onClick={() => onVote("dislike")}
        disabled={disabled}
        aria-label="Nie lubię komentarza"
        aria-pressed={comment.myVote === "dislike"}
        className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60 ${
          comment.myVote === "dislike"
            ? "bg-red-500 text-black"
            : "bg-ph-panel text-ph-muted hover:bg-red-500/15 hover:text-red-400"
        }`}
      >
        <ThumbsDown className="h-3.5 w-3.5" /> {comment.dislikes}
      </button>
    </>
  );
}

export default function Comments({
  videoId,
  initialComments,
  me: initialMe,
}: {
  videoId: number;
  initialComments: CommentItem[];
  me: string | null;
}) {
  const [list, setList] = useState<CommentItem[]>(initialComments);
  const [me, setMe] = useState<string | null>(initialMe);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingVote, setPendingVote] = useState<number | null>(null);
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replySending, setReplySending] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  const count = list.length;
  const trimmed = text.trim();
  const charCount = text.length;

  // Komentarze główne + odpowiedzi przypięte do nich (maks. jeden poziom).
  const tree = useMemo(() => {
    const roots: CommentItem[] = [];
    const byParent = new Map<number, CommentItem[]>();
    for (const c of list) {
      if (c.parentId === null) {
        roots.push(c);
      } else {
        const arr = byParent.get(c.parentId) ?? [];
        arr.push(c);
        byParent.set(c.parentId, arr);
      }
    }
    const newestFirst = (a: CommentItem, b: CommentItem) =>
      b.createdAt.localeCompare(a.createdAt);
    const oldestFirst = (a: CommentItem, b: CommentItem) =>
      a.createdAt.localeCompare(b.createdAt);
    roots.sort(newestFirst);
    for (const arr of byParent.values()) arr.sort(oldestFirst);
    return { roots, byParent };
  }, [list]);

  // Gdy ciasteczka są blokowane (podgląd w iframe), sesję potwierdzamy
  // tokenem z localStorage i dociągamy komentarze wraz z moim głosem.
  useEffect(() => {
    let alive = true;
    if (initialMe) return;
    fetchMe().then(async (u) => {
      if (!alive || !u) return;
      setMe(u);
      try {
        const res = await authFetch(`/api/videos/${videoId}/comments`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = await res.json();
        const fresh = Array.isArray(data.comments)
          ? (data.comments as CommentItem[])
          : [];
        if (!alive) return;
        setList((prev) => {
          const byId = new Map(fresh.map((c) => [c.id, c]));
          const merged = prev.map((c) => byId.get(c.id) ?? c);
          const extra = fresh.filter((c) => !prev.some((p) => p.id === c.id));
          return [...extra, ...merged];
        });
      } catch {
        /* zostaje lista z serwera */
      }
    });
    return () => {
      alive = false;
    };
  }, [initialMe, videoId]);

  /** Wysyła komentarz lub odpowiedź. Zwraca utworzony wpis albo null. */
  async function postComment(
    raw: string,
    parentId: number | null
  ): Promise<CommentItem | null> {
    const body = raw.trim();
    if (!body) return null;
    if (!me && !getToken()) {
      setError("Musisz się zalogować, aby komentować.");
      return null;
    }
    if (body.length > MAX_LEN) {
      setError(`Komentarz może mieć maksymalnie ${MAX_LEN} znaków.`);
      return null;
    }
    setError(null);
    try {
      const res = await authFetch(`/api/videos/${videoId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, parentId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Nie udało się dodać komentarza.");
        return null;
      }
      const created = data.comment as CommentItem;
      setList((prev) => [created, ...prev]);
      setMe(created.username);
      setNotice(null);
      return created;
    } catch {
      setError("Błąd połączenia. Spróbuj ponownie.");
      return null;
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!trimmed || sending || replySending) return;
    setSending(true);
    const created = await postComment(trimmed, null);
    if (created) setText("");
    setSending(false);
  }

  function openReply(comment: CommentItem) {
    if (!me) {
      setNotice("Zaloguj się, aby odpowiadać na komentarze.");
      return;
    }
    setError(null);
    setNotice(null);
    setReplyTo(comment.id);
    // Odpowiedź na odpowiedź trafia do tego samego wątku – oznaczamy adresata.
    setReplyText(comment.parentId !== null ? `@${comment.username} ` : "");
  }

  function closeReply() {
    setReplyTo(null);
    setReplyText("");
  }

  async function submitReply(comment: CommentItem) {
    if (!replyText.trim() || replySending) return;
    setReplySending(true);
    const created = await postComment(replyText, comment.id);
    if (created) closeReply();
    setReplySending(false);
  }

  async function removeComment(comment: CommentItem) {
    if (deleting !== null) return;
    const question =
      comment.parentId === null
        ? "Usunąć ten komentarz razem z odpowiedziami? Tego nie da się cofnąć."
        : "Usunąć tę odpowiedź? Tego nie da się cofnąć.";
    if (!confirm(question)) return;

    setDeleting(comment.id);
    setError(null);
    try {
      const res = await authFetch(`/api/comments/${comment.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Nie udało się usunąć komentarza.");
        return;
      }
      const removedReplyTo =
        replyTo !== null &&
        (replyTo === comment.id ||
          list.some((c) => c.id === replyTo && c.parentId === comment.id));
      setList((prev) =>
        prev.filter(
          (c) => c.id !== comment.id && c.parentId !== comment.id
        )
      );
      if (removedReplyTo) closeReply();
    } catch {
      setError("Błąd połączenia. Spróbuj ponownie.");
    } finally {
      setDeleting(null);
    }
  }

  async function vote(comment: CommentItem, type: "like" | "dislike") {
    if (pendingVote === comment.id) return;
    if (!me) {
      setNotice("Zaloguj się, aby polubić albo odrzucić komentarz.");
      return;
    }
    setPendingVote(comment.id);
    setError(null);
    setNotice(null);
    try {
      const res = await authFetch(`/api/comments/${comment.id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401) setMe(null);
        setError(data.error ?? "Nie udało się zapisać głosu.");
        return;
      }
      setList((prev) =>
        prev.map((c) =>
          c.id === comment.id
            ? {
                ...c,
                likes: data.likes as number,
                dislikes: data.dislikes as number,
                myVote: data.myVote as CommentItem["myVote"],
              }
            : c
        )
      );
    } catch {
      setError("Błąd połączenia. Spróbuj ponownie.");
    } finally {
      setPendingVote(null);
    }
  }

  function renderReplyForm(comment: CommentItem) {
    if (replyTo !== comment.id) return null;
    return (
      <div className="mt-3 rounded-lg border border-ph-border bg-ph-black/60 p-3">
        <p className="mb-2 flex items-center gap-1.5 text-xs text-ph-muted">
          <CornerDownRight className="h-3.5 w-3.5 text-ph-orange" />
          Odpowiadasz na komentarz{" "}
          <span className="font-semibold text-ph-orange">
            @{comment.username}
          </span>
        </p>
        <textarea
          autoFocus
          value={replyText}
          onChange={(e) => setReplyText(e.target.value.slice(0, MAX_LEN))}
          placeholder="Napisz odpowiedź…"
          rows={2}
          maxLength={MAX_LEN}
          className="w-full resize-y rounded-md border border-ph-border bg-ph-black px-3 py-2 text-sm text-white placeholder-ph-muted outline-none transition-colors focus:border-ph-orange"
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <span
            className={`text-xs ${
              replyText.length > MAX_LEN - 100
                ? "text-ph-orange"
                : "text-ph-muted"
            }`}
          >
            {replyText.length}/{MAX_LEN}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={closeReply}
              className="rounded-full px-3 py-1.5 text-xs font-semibold text-ph-muted transition-colors hover:text-white"
            >
              Anuluj
            </button>
            <button
              type="button"
              onClick={() => submitReply(comment)}
              disabled={replySending || !replyText.trim()}
              className="flex items-center gap-1.5 rounded-full bg-ph-orange px-4 py-1.5 text-xs font-bold text-black transition-all hover:bg-ph-orange-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {replySending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              Odpowiedz
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderComment(comment: CommentItem, isReply: boolean) {
    const mine = me === comment.username;
    return (
      <div className="flex items-start gap-3">
        <Avatar username={comment.username} size={isReply ? 32 : 40} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span className="flex items-center gap-1 font-display font-bold text-white">
              {comment.username}
              {isVerified(comment.username) && (
                <VerifiedBadge className="h-4 w-4" />
              )}
            </span>
            {isReply && (
              <span className="rounded bg-ph-panel px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ph-muted">
                odpowiedź
              </span>
            )}
            <span className="text-xs text-ph-muted">
              {timeAgo(new Date(comment.createdAt))}
            </span>
            {mine && (
              <span className="text-[11px] text-ph-orange">• Ty</span>
            )}
          </p>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-ph-text">
            {comment.body}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <VoteButtons
              comment={comment}
              disabled={pendingVote === comment.id}
              onVote={(type) => vote(comment, type)}
            />
            <button
              type="button"
              onClick={() => openReply(comment)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                replyTo === comment.id
                  ? "bg-ph-orange/15 text-ph-orange"
                  : "bg-ph-panel text-ph-muted hover:bg-ph-border hover:text-white"
              }`}
            >
              <CornerDownRight className="h-3.5 w-3.5" /> Odpowiedz
            </button>
            {mine && (
              <button
                type="button"
                onClick={() => removeComment(comment)}
                disabled={deleting === comment.id}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300 disabled:opacity-60"
              >
                {deleting === comment.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                Usuń
              </button>
            )}
          </div>

          {renderReplyForm(comment)}
        </div>
      </div>
    );
  }

  return (
    <section className="mt-8 rounded-xl border border-ph-border bg-ph-dark p-5">
      <h2 className="flex items-center gap-2 font-display text-lg font-extrabold text-white">
        <MessageSquare className="h-5 w-5 text-ph-orange" />
        Komentarze <span className="text-ph-orange">({count})</span>
      </h2>

      {/* Dodawanie komentarza */}
      {me ? (
        <form onSubmit={submit} className="mt-4 flex items-start gap-3">
          <Avatar username={me} />
          <div className="min-w-0 flex-1">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, MAX_LEN))}
              placeholder="Napisz komentarz… (kultura wypowiedzi obowiązkowa, regulamin też)"
              rows={3}
              maxLength={MAX_LEN}
              className="w-full resize-y rounded-lg border border-ph-border bg-ph-black px-3 py-2.5 text-sm text-white placeholder-ph-muted outline-none transition-colors focus:border-ph-orange"
            />
            <div className="mt-2 flex items-center justify-between gap-3">
              <span
                className={`text-xs ${
                  charCount > MAX_LEN - 100 ? "text-ph-orange" : "text-ph-muted"
                }`}
              >
                {charCount}/{MAX_LEN}
              </span>
              <button
                type="submit"
                disabled={sending || !trimmed}
                className="flex items-center gap-2 rounded-full bg-ph-orange px-5 py-2 text-sm font-bold text-black transition-all hover:bg-ph-orange-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Dodaj komentarz
              </button>
            </div>
          </div>
        </form>
      ) : (
        <div className="mt-4 flex flex-col items-start gap-3 rounded-lg border border-dashed border-ph-border bg-ph-black/60 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-ph-muted">
            Chcesz skomentować? Musisz mieć konto.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/login"
              className="flex items-center gap-2 rounded-full bg-ph-orange px-4 py-2 text-sm font-bold text-black transition-colors hover:bg-ph-orange-hover"
            >
              <LogIn className="h-4 w-4" /> Zaloguj się
            </Link>
            <Link
              href="/register"
              className="rounded-full border border-ph-border px-4 py-2 text-sm font-semibold text-white transition-colors hover:border-ph-orange hover:text-ph-orange"
            >
              Zarejestruj się
            </Link>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-400">
          {error}
        </p>
      )}
      {notice && (
        <p className="mt-3 text-sm text-ph-orange">
          {notice}{" "}
          <Link href="/login" className="font-bold underline underline-offset-2">
            Zaloguj się
          </Link>
        </p>
      )}

      {/* Lista komentarzy */}
      {tree.roots.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-ph-border px-4 py-10 text-center">
          <MessageSquare className="mx-auto h-7 w-7 text-ph-border" />
          <p className="mt-2 font-display font-bold text-white">
            Nikt nic nie napisał
          </p>
          <p className="mt-1 text-sm text-ph-muted">
            Bądź pierwszy. Albo drugi – nikt nie liczy.
          </p>
        </div>
      ) : (
        <ul className="mt-5 space-y-5">
          {tree.roots.map((root) => {
            const replies = tree.byParent.get(root.id) ?? [];
            return (
              <li key={root.id} className="animate-fade-up">
                {renderComment(root, false)}
                {replies.length > 0 && (
                  <ul className="mt-4 space-y-4 border-l-2 border-ph-border pl-3 sm:pl-4">
                    {replies.map((reply) => (
                      <li key={reply.id}>{renderComment(reply, true)}</li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
