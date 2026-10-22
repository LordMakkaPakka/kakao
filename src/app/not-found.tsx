import Link from "next/link";
import { SearchX, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-16 text-center">
      <div className="animate-fade-up flex flex-col items-center">
        <p className="font-display text-7xl font-black text-ph-orange sm:text-8xl">404</p>
        <SearchX className="mt-4 h-10 w-10 text-ph-muted" />
        <h1 className="mt-4 font-display text-2xl font-extrabold text-white">
          Ten film nie istnieje
        </h1>
        <p className="mt-2 max-w-md text-sm text-ph-muted">
          Zresztą, na tej stronie prawie żaden film nie istnieje. To nie Twoja wina.
        </p>
        <Link
          href="/"
          className="mt-8 flex items-center gap-2 rounded-full bg-ph-orange px-7 py-3 font-display text-sm font-black uppercase tracking-wide text-black transition-all hover:bg-ph-orange-hover"
        >
          <Home className="h-4 w-4" /> Strona główna
        </Link>
      </div>
    </div>
  );
}