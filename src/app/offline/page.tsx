import type { Metadata } from "next";
import { WifiOff } from "lucide-react";
import { Logo } from "@/components/layout/logo";

export const metadata: Metadata = { title: "Offline", robots: { index: false } };
export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main id="inhalt" className="container-page flex min-h-dvh flex-col items-center justify-center gap-6 text-center">
      <Logo />
      <div className="flex size-14 items-center justify-center rounded-2xl bg-mint-100 text-forest">
        <WifiOff className="size-7" aria-hidden />
      </div>
      <div>
        <h1 className="font-display text-2xl font-extrabold">Keine Internetverbindung</h1>
        <p className="mt-2 max-w-sm text-muted-foreground">
          Sobald Sie wieder online sind, können Sie Immovia wie gewohnt nutzen. Ihre Eingaben im Verkaufsassistenten werden
          automatisch gespeichert, sobald die Verbindung besteht.
        </p>
      </div>
    </main>
  );
}
