import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { Archivo, Barlow } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AgeGate from "@/components/AgeGate";
import { getSessionUser } from "@/lib/auth";

const archivo = Archivo({
  subsets: ["latin", "latin-ext"],
  weight: ["600", "700", "800", "900"],
  variable: "--font-archivo",
});

const barlow = Barlow({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-barlow",
});

export const metadata: Metadata = {
  title: "PolHub – Największy polski serwis z filmami (na razie pustymi)",
  description:
    "PolHub – wrzucaj i oglądaj filmy. Konto wymagane do przesyłania. 100% polskich pikseli.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  const ageOk = (await cookies()).get("ph_age_ok")?.value === "1";

  return (
    <html lang="pl" className={`${archivo.variable} ${barlow.variable}`}>
      <body className="min-h-screen bg-ph-black text-ph-text antialiased">
        <AgeGate initialAccepted={ageOk} />
        <Header user={user} />
        <main className="min-h-[70vh]">{children}</main>
        <Footer />
      </body>
    </html>
  );
}