"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck } from "lucide-react";

/**
 * Ustawia ciasteczko potwierdzenia wieku i wraca na stronę główną,
 * żeby nie trzeba było przechodzić przez bramkę po raz drugi.
 */
export default function AcceptTermsButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  function accept() {
    document.cookie = "ph_age_ok=1; path=/; max-age=31536000; SameSite=Lax";
    setBusy(true);
    router.push("/");
    router.refresh();
  }

  return (
    <button
      onClick={accept}
      disabled={busy}
      className="flex items-center gap-2 rounded-full bg-ph-orange px-6 py-3 font-display text-sm font-black uppercase tracking-wide text-black transition-all hover:bg-ph-orange-hover hover:shadow-[0_0_24px_rgba(255,144,0,0.45)] disabled:opacity-60"
    >
      <BadgeCheck className="h-4 w-4" />
      Akceptuję regulamin i wchodzę
    </button>
  );
}
