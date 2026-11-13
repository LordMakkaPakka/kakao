import { getSessionUser } from "@/lib/auth";
import { telegramStatus } from "@/lib/telegram";
import EmbedForm, { EmbedLoginWall } from "@/components/EmbedForm";
import TelegramGate from "@/components/TelegramGate";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = { title: "Dodaj film – PolHub" };

export default async function UploadPage() {
  const user = await getSessionUser();
  const telegram = await telegramStatus(user);
  const blocked = !!user && telegram.required && !telegram.linked && !telegram.exempt;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link
        href="/"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-ph-muted transition-colors hover:text-ph-orange"
      >
        <ArrowLeft className="h-4 w-4" /> Wróć na stronę główną
      </Link>
      <div className="mb-8">
        <h1 className="font-display text-2xl font-black text-white sm:text-3xl">
          Dodaj <span className="text-ph-orange">film</span>
        </h1>
        <p className="mt-2 text-sm text-ph-muted">
          {user ? (
            <>
              Witaj, <span className="font-bold text-ph-orange">{user}</span>! Film
              dodajesz wklejając embed z serwisu, w którym go opublikowałeś. Każdy
              film dostaje intro PolHub i naszą ramkę odtwarzacza. 🥁
            </>
          ) : (
            "Filmy dodajemy przez embed — wklejasz adres filmu z zewnętrznego serwisu."
          )}
        </p>
      </div>

      {!user ? (
        <EmbedLoginWall />
      ) : blocked ? (
        <TelegramGate status={telegram} />
      ) : (
        <EmbedForm />
      )}
    </div>
  );
}
