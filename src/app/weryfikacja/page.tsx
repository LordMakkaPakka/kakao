import { redirect } from "next/navigation";

/** Stary adres panelu – teraz cała moderacja jest pod /admin. */
export default function WeryfikacjaPage() {
  redirect("/admin");
}
