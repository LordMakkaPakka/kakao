"use client";

import { useState, type ReactNode } from "react";
import { Loader2, Trash2 } from "lucide-react";

type Props = {
  /** Tekst przycisku, np. „Usuń film”. */
  label: string;
  /** Pytanie pokazywane po kliknięciu, np. „Usunąć film «X»?”. */
  question: string;
  onConfirm: () => void | Promise<void>;
  /** Trwa usuwanie (pokazuje spinner). */
  busy?: boolean;
  /** Ikona przycisku – domyślnie kosz. */
  icon?: ReactNode;
  triggerClassName?: string;
  /** Dodatkowa treść (np. ostrzeżenie), opcjonalna. */
  hint?: string;
};

/**
 * Przycisk usuwania z potwierdzeniem w aplikacji.
 *
 * Nie używamy `window.confirm`, bo w osadzonym podglądzie (iframe bez
 * `allow-modals`) przeglądarka po cichu zwraca `false` i nic się nie dzieje.
 */
export default function ConfirmDeleteButton({
  label,
  question,
  onConfirm,
  busy = false,
  icon,
  triggerClassName,
  hint,
}: Props) {
  const [asking, setAsking] = useState(false);
  const [pending, setPending] = useState(false);

  async function run() {
    setPending(true);
    try {
      await onConfirm();
      setAsking(false);
    } finally {
      setPending(false);
    }
  }

  if (asking) {
    return (
      <span className="inline-flex flex-wrap items-center justify-end gap-2 rounded-lg border border-red-400/50 bg-red-500/10 px-2.5 py-1.5 text-xs text-red-200">
        <span className="font-semibold">
          {question}
          {hint ? <span className="block font-normal text-red-300/80">{hint}</span> : null}
        </span>
        <button
          type="button"
          onClick={run}
          disabled={pending || busy}
          className="flex items-center gap-1.5 rounded-full bg-red-500 px-3 py-1 font-bold text-black transition-colors hover:bg-red-400 disabled:opacity-60"
        >
          {pending || busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
          Tak, usuń
        </button>
        <button
          type="button"
          onClick={() => setAsking(false)}
          disabled={pending}
          className="rounded-full border border-ph-border px-3 py-1 font-semibold text-white transition-colors hover:border-ph-orange hover:text-ph-orange disabled:opacity-60"
        >
          Anuluj
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setAsking(true)}
      disabled={busy}
      className={
        triggerClassName ??
        "flex items-center gap-1.5 rounded-full border border-ph-border px-3 py-1.5 text-xs font-semibold text-red-400 transition-colors hover:border-red-400 hover:bg-red-500/10 disabled:opacity-60"
      }
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        icon ?? <Trash2 className="h-3.5 w-3.5" />
      )}
      {label}
    </button>
  );
}
