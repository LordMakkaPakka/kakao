import { Check } from "lucide-react";

/**
 * Niebieska odznaka weryfikacji – kółko z białym ptaszkiem.
 * Używana przy nazwach zweryfikowanych kont (np. SweetieFox).
 */
export default function VerifiedBadge({
  className = "h-4 w-4",
  title = "Zweryfikowane konto",
}: {
  className?: string;
  title?: string;
}) {
  return (
    <span
      role="img"
      aria-label={title}
      title={title}
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-[#1d9bf0] text-white shadow-[0_0_0_1px_rgba(0,0,0,0.15)] ${className}`}
    >
      <Check className="h-[62%] w-[62%]" strokeWidth={4} aria-hidden="true" />
    </span>
  );
}
