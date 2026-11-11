import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { sql } from "drizzle-orm";
import { databaseInfo, db } from "@/db";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AgeGate from "@/components/AgeGate";
import { getSessionUser } from "@/lib/auth";
import { isVerifiedAccount } from "@/lib/verification";
import { classifyDbFailure, dbFailureMessage } from "@/lib/dbErrors";
import DbFailureScreen from "@/components/DbFailureScreen";

export const metadata: Metadata = {
  title: "PolHub",
  description:
    "PolHub – wrzucaj i oglądaj filmy. Konto wymagane do przesyłania. 100% polskich pikseli.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const ageOk = (await cookies()).get("ph_age_ok")?.value === "1";

  // Gdy baza jest niedostępna (np. przekroczony limit hostingu), pokazujemy
  // jasny komunikat zamiast wywalać całą stronę stosem błędów.
  let user: string | null = null;
  let userVerified = false;
  let dbFailure: ReturnType<typeof classifyDbFailure> | null = null;
  try {
    if (!databaseInfo().configured) {
      throw new Error("Brak zmiennej z adresem bazy (DATABASE_URL / POSTGRES_URL).");
    }
    // Szybka sonda: jeśli baza odrzuca nawet „select 1”, nie ma sensu
    // renderować podstron (skończyłoby się błędem 500).
    await db.execute(sql`select 1`);
    user = await getSessionUser();
    userVerified = user ? await isVerifiedAccount(user) : false;
  } catch (err) {
    dbFailure = classifyDbFailure(err);
    console.error("[polhub] baza niedostępna:", err);
  }

  return (
    <html lang="pl">
      <body className="min-h-screen bg-ph-black text-ph-text antialiased">
        <AgeGate initialAccepted={ageOk} />
        <Header user={user} verified={userVerified} />
        <main className="min-h-[70vh]">
          {dbFailure ? (
            <DbFailureScreen
              kind={dbFailure}
              message={dbFailureMessage(dbFailure)}
            />
          ) : (
            children
          )}
        </main>
        <Footer />
      </body>
    </html>
  );
}