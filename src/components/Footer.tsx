import Link from "next/link";
import { ShieldCheck, Cookie, Globe, HeartHandshake } from "lucide-react";

const LINKS: { title: string; items: string[] }[] = [
  {
    title: "PolHub",
    items: ["O nas", "Prasa", "Kariera (nie rekrutujemy)", "Blog"],
  },
  {
    title: "Informacje",
    items: ["Regulamin", "Polityka prywatności", "Pliki cookie (te z mlekiem)", "DMCA"],
  },
  {
    title: "Pomoc",
    items: ["Centrum pomocy", "Kontakt", "Zgłoś pustą stronę", "Status serwisu: pusto"],
  },
];

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-ph-border bg-black">
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="font-display text-2xl font-black">
              <span className="text-white">Pol</span>
              <span className="ml-1 rounded-md bg-ph-orange px-2 py-0.5 text-black">Hub</span>
            </p>
            <p className="mt-4 text-sm leading-relaxed text-ph-muted">
              Największy polski serwis z filmami, na którym nie ma żadnych
              filmów. Dopóki Gnam czegoś nie wrzuci.
            </p>
            <div className="mt-4 flex items-center gap-2 text-xs text-ph-muted">
              <ShieldCheck className="h-4 w-4 text-ph-orange" />
              100% bezpieczny. 0% treści.
            </div>
          </div>
          {LINKS.map((group) => (
            <div key={group.title}>
              <h3 className="font-display text-sm font-bold uppercase tracking-wider text-ph-orange">
                {group.title}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {group.items.map((item) => (
                  <li key={item}>
                    <Link
                      href="/"
                      className="text-sm text-ph-muted transition-colors hover:text-white hover:underline"
                    >
                      {item}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-ph-border pt-6 text-xs text-ph-muted sm:flex-row">
          <p>© 2026 PolHub. Wszelkie prawa zastrzeżone. Wszystkie filmy niezastrzeżone, bo ich nie ma.</p>
          <div className="flex items-center gap-5">
            <span className="flex items-center gap-1.5">
              <Globe className="h-4 w-4" /> Polski
            </span>
            <span className="flex items-center gap-1.5">
              <Cookie className="h-4 w-4" /> Cookies
            </span>
            <span className="flex items-center gap-1.5">
              <HeartHandshake className="h-4 w-4 text-ph-orange" /> Zrobione z sercem
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}