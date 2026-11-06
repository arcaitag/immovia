import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/layout/logo";

export const metadata: Metadata = {
  title: "Einladung",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function InvitationLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <header className="container-page flex h-[4.25rem] items-center">
        <Logo />
      </header>
      <main id="inhalt" className="container-page flex flex-1 items-start justify-center py-8 sm:items-center sm:py-12">
        <div className="w-full max-w-lg">{children}</div>
      </main>
      <footer className="container-page py-6 text-center text-xs text-muted-foreground">
        <Link href="/datenschutz" className="hover:text-forest">
          Datenschutz
        </Link>
        <span className="mx-2">·</span>
        <Link href="/kontakt" className="hover:text-forest">
          Hilfe
        </Link>
      </footer>
    </div>
  );
}
