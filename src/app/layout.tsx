import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AgeGate from "@/components/AgeGate";
import { getSessionUser } from "@/lib/auth";
import { isVerifiedAccount } from "@/lib/verification";

export const metadata: Metadata = {
  title: "PolHub",
  description:
    "PolHub – wrzucaj i oglądaj filmy. Konto wymagane do przesyłania. 100% polskich pikseli.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  const userVerified = user ? await isVerifiedAccount(user) : false;
  const ageOk = (await cookies()).get("ph_age_ok")?.value === "1";

  return (
    <html lang="pl">
      <body className="min-h-screen bg-ph-black text-ph-text antialiased">
        <AgeGate initialAccepted={ageOk} />
        <Header user={user} verified={userVerified} />
        <main className="min-h-[70vh]">{children}</main>
        <Footer />
      </body>
    </html>
  );
}