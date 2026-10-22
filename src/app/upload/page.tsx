import { getSessionUser } from "@/lib/auth";
import UploadGate from "@/components/UploadGate";

export const dynamic = "force-dynamic";

export const metadata = { title: "Prześlij film – PolHub" };

export default async function UploadPage() {
  const user = await getSessionUser();
  return <UploadGate initialUser={user} />;
}