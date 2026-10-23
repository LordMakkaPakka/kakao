"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const COOKIE = "ph_age_ok";
const EXIT_URL = "https://www.google.com";

export default function AgeGate({
  initialAccepted,
}: {
  initialAccepted: boolean;
}) {
  const [accepted, setAccepted] = useState(initialAccepted);
  const pathname = usePathname();
  const active = !accepted && pathname !== "/regulamin";

  useEffect(() => {
    if (!active) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [active]);

  if (!active) return null;

  const enter = () => {
    document.cookie = `${COOKIE}=1; path=/; max-age=31536000; SameSite=Lax`;
    setAccepted(true);
  };

  const exit = () => {
    window.location.href = EXIT_URL;
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Weryfikacja wieku"
      className="fixed inset-0 z-[100] overflow-y-auto bg-black"
    >
      <div className="flex min-h-full items-center justify-center px-3 py-8 sm:px-4">
        {/* Czarny prostokąt – bramka jak na prawdziwym PH */}
        <div className="w-full max-w-2xl rounded-xl border border-[#232323] bg-[#0d0d0d] px-5 py-9 text-center shadow-[0_24px_70px_rgba(0,0,0,0.9)] sm:px-10 sm:py-11">
          <p className="font-display text-4xl font-black tracking-tight sm:text-5xl">
            <span className="text-white">Pol</span>
            <span className="ml-1 rounded-md bg-ph-orange px-2 py-0.5 text-black">
              Hub
            </span>
          </p>

          <h1 className="mt-7 font-display text-2xl font-extrabold text-white sm:text-4xl">
            Weryfikacja wieku
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-sm leading-relaxed text-ph-text sm:text-[15px]">
            Ta strona zawiera materiały przeznaczone wyłącznie dla osób
            dorosłych, w tym nagość oraz jawne sceny seksualne. Wchodząc,
            potwierdzasz, że masz ukończone 18 lat (lub osiągnąłeś wiek
            pełnoletności w miejscu, z którego korzystasz z serwisu) i wyrażasz
            zgodę na oglądanie treści o charakterze seksualnym. Wchodząc na tą
            stronę akceptujesz{" "}
            <Link
              href="/regulamin"
              className="font-semibold text-ph-orange underline underline-offset-2 transition-colors hover:text-ph-orange-hover"
            >
              regulamin
            </Link>
            .
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={enter}
              className="flex-1 rounded-md bg-ph-orange px-6 py-4 font-display text-sm font-black uppercase tracking-wide text-black transition-colors hover:bg-ph-orange-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              Yes, I’m 18 or older - enter
            </button>
            <button
              onClick={exit}
              className="flex-1 rounded-md bg-[#2b2b2b] px-6 py-4 font-display text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-[#3a3a3a] focus:outline-none focus-visible:ring-2 focus-visible:ring-ph-orange focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              No, I’m under 18 - exit
            </button>
          </div>

          <p className="mt-7 text-sm leading-relaxed text-ph-muted">
            Nasza{" "}
            <span className="text-ph-orange">
              strona kontroli rodzicielskiej
            </span>{" "}
            wyjaśnia, jak łatwo zablokować dostęp do tej strony.
          </p>
        </div>
      </div>
    </div>
  );
}
