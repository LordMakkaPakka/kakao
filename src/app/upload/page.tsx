import { getSessionUser } from "@/lib/auth";
import UploadGate from "@/components/UploadGate";
import { telegramStatus } from "@/lib/telegram";

export const dynamic = "force-dynamic";

export const metadata = { title: "Prześlij film – PolHub" };

export default async function UploadPage() {
  const user = await getSessionUser();
  const telegram = await telegramStatus(user);
  return <UploadGate initialUser={user} initialTelegram={telegram} />;
}