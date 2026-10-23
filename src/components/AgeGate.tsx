"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { NOTICES, TERMS, type Section } from "@/lib/terms";

const COOKIE = "ph_age_ok";
const EXIT_URL = "https://www.google.com";

function Sections({ sections }: { sections: Section[] }) {
  return (
    <div className="space-y-5">
      {sections.map((s) => (
        <section key={s.title}>
          <h3 className="font-display text-sm font-bold text-white">{s.title}</h3>
          <div className="mt-1.5 space-y-1.5">
            {s.paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export default function AgeGate({ initialAccepted }: { initialAccepted: boolean }) {
  const [accepted, setAccepted] = useState(initialAccepted);
  const [showTerms, setShowTerms] = useState(false);
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

  useEffect(() => {
    if (!showTerms) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowTerms(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showTerms]);

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
      <div className="mx-auto flex min-h-full max-w-3xl flex-col items-center px-4 py-8 sm:py-12">
        <p className="font-display text-4xl font-black">
          <span className="text-white">Pol</span>
          <span className="ml-1 rounded-md bg-ph-orange px-2 py-0.5 text-black">Hub</span>
        </p>
        <p className="mt-4 rounded-md border border-ph-orange px-3 py-1 font-display text-sm font-black uppercase tracking-widest text-ph-orange">
          Tylko dla osób pełnoletnich · 18+
        </p>

        {/* Regulamin – góra */}
        <h2 className="mt-8 self-start font-display text-lg font-extrabold text-white">
          Regulamin serwisu
        </h2>
        <div className="mt-2 h-72 w-full overflow-y-auto rounded-xl border border-ph-border bg-ph-dark p-4 text-xs leading-relaxed text-ph-muted sm:h-80 sm:text-sm">
          <Sections sections={TERMS} />
        </div>

        {/* Przyciski – środek */}
        <div className="my-8 flex w-full flex-col items-stretch gap-3 sm:flex-row">
          <button
            onClick={enter}
            className="flex-1 rounded-full bg-ph-orange px-6 py-4 font-display text-sm font-black uppercase tracking-wide text-black transition-all hover:bg-ph-orange-hover hover:shadow-[0_0_24px_rgba(255,144,0,0.45)]"
          >
            Yes, I’m 18 or older - enter
          </button>
          <button
            onClick={exit}
            className="flex-1 rounded-full border border-ph-border px-6 py-4 font-display text-sm font-bold uppercase tracking-wide text-white transition-colors hover:border-ph-orange hover:text-ph-orange"
          >
            No, I’m under 18 - exit
          </button>
        </div>

        {/* Dodatkowe informacje – dół */}
        <h2 className="self-start font-display text-lg font-extrabold text-white">
          Ostrzeżenia i informacje dodatkowe
        </h2>
        <div className="mt-2 h-60 w-full overflow-y-auto rounded-xl border border-ph-border bg-ph-dark p-4 text-xs leading-relaxed text-ph-muted sm:text-sm">
          <Sections sections={NOTICES} />
        </div>

        <p className="mt-8 text-center text-sm text-ph-muted">
          Wchodząc na stronę akceptujesz{" "}
          <button
            onClick={() => setShowTerms(true)}
            className="font-semibold text-ph-orange underline underline-offset-2 hover:text-ph-orange-hover"
          >
            regulamin
          </button>
          .
        </p>
      </div>

      {showTerms && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setShowTerms(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Regulamin"
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-ph-border bg-ph-dark"
          >
            <div className="flex items-center justify-between border-b border-ph-border px-5 py-4">
              <h2 className="font-display text-xl font-black text-white">Regulamin</h2>
              <button
                onClick={() => setShowTerms(false)}
                aria-label="Zamknij regulamin"
                className="rounded-md p-1 text-ph-muted transition-colors hover:text-ph-orange"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto px-5 py-4 text-sm leading-relaxed text-ph-muted">
              <Sections sections={TERMS} />
            </div>
            <div className="border-t border-ph-border px-5 py-3 text-right">
              <button
                onClick={() => setShowTerms(false)}
                className="rounded-full bg-ph-orange px-5 py-2 text-sm font-black text-black hover:bg-ph-orange-hover"
              >
                Zamknij
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
