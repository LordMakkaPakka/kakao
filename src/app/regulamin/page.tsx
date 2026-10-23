import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import { NOTICES, TERMS, type Section } from "@/lib/terms";
import AcceptTermsButton from "@/components/AcceptTermsButton";

export const metadata: Metadata = { title: "Regulamin – PolHub" };

function FinePrint({ sections }: { sections: Section[] }) {
  return (
    <div className="space-y-5">
      {sections.map((s) => (
        <section key={s.title}>
          <h3 className="font-display text-[11px] font-bold uppercase tracking-wider text-ph-text sm:text-xs">
            {s.title}
          </h3>
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

export default function RegulaminPage() {
  return (
    <div className="mx-auto max-w-3xl px-3 py-8 sm:px-4 sm:py-12">
      {/* Ten sam czarny prostokąt co bramka 18+ */}
      <div className="rounded-xl border border-[#232323] bg-[#0d0d0d] px-5 py-8 shadow-[0_24px_70px_rgba(0,0,0,0.75)] sm:px-10 sm:py-10">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-ph-muted transition-colors hover:text-ph-orange"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Wróć na stronę główną
        </Link>

        <div className="mt-6 text-center">
          <p className="font-display text-3xl font-black tracking-tight">
            <span className="text-white">Pol</span>
            <span className="ml-1 rounded-md bg-ph-orange px-2 py-0.5 text-black">
              Hub
            </span>
          </p>
          <h1 className="mt-5 font-display text-2xl font-black text-white sm:text-3xl">
            Regulamin <span className="text-ph-orange">serwisu</span>
          </h1>
          <p className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-ph-muted">
            <FileText className="h-3.5 w-3.5" />
            Pełna treść · ostatnia aktualizacja: 23 października 2026 · wersja 1.0
          </p>
        </div>

        <p className="mx-auto mt-6 max-w-xl rounded-lg border border-ph-border bg-black/60 px-4 py-3 text-center text-[11px] leading-relaxed text-ph-muted">
          Poniższy regulamin napisany jest drobnym maczkiem – dokładnie tak, jak
          lubią to prawnicy. Wchodząc na tą stronę akceptujesz regulamin, nawet
          jeśli go nie przeczytałeś. Możesz to nadrobić teraz.
        </p>

        <div className="mt-8 text-[10.5px] leading-[1.7] text-ph-muted sm:text-[11.5px]">
          <FinePrint sections={TERMS} />
        </div>

        <h2 className="mt-10 border-t border-ph-border pt-6 font-display text-sm font-extrabold text-white">
          Informacje dodatkowe i{" "}
          <span className="text-ph-orange">ostrzeżenia</span>
        </h2>
        <div className="mt-3 text-[10.5px] leading-[1.7] text-ph-muted sm:text-[11.5px]">
          <FinePrint sections={NOTICES} />
        </div>

        <div className="mt-10 flex flex-col items-center gap-3 border-t border-ph-border pt-6">
          <p className="text-center text-[11px] text-ph-muted">
            Wchodząc na tą stronę akceptujesz regulamin.
          </p>
          <AcceptTermsButton />
          <Link
            href="/"
            className="text-[11px] text-ph-muted underline underline-offset-2 transition-colors hover:text-ph-orange"
          >
            Wróć na stronę główną
          </Link>
        </div>
      </div>
    </div>
  );
}
