import type { Metadata } from "next";
import { TERMS } from "@/lib/terms";

export const metadata: Metadata = { title: "Regulamin – PolHub" };

export default function RegulaminPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-3xl font-black text-white">
        Regulamin <span className="text-ph-orange">serwisu</span>
      </h1>
      <div className="mt-8 space-y-6 text-sm leading-relaxed text-ph-muted">
        {TERMS.map((s) => (
          <section key={s.title}>
            <h2 className="font-display text-base font-bold text-white">{s.title}</h2>
            <div className="mt-2 space-y-2">
              {s.paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
