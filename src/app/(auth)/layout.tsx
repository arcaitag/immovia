import Image from "next/image";
import Link from "next/link";
import { Logo } from "@/components/layout/logo";
import { MARKETING_IMAGES } from "@/lib/marketing-images";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
      <div className="flex flex-col px-5 py-6 sm:px-10">
        <Logo />
        <main id="inhalt" className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          {children}
        </main>
        <p className="text-center text-xs text-muted-foreground">
          <Link href="/datenschutz" className="hover:text-forest">Datenschutz</Link>
          <span className="mx-2">·</span>
          <Link href="/agb" className="hover:text-forest">AGB</Link>
          <span className="mx-2">·</span>
          <Link href="/kontakt" className="hover:text-forest">Hilfe</Link>
        </p>
      </div>
      <aside className="relative hidden overflow-hidden lg:block">
        <Image src={MARKETING_IMAGES.auth.src} alt="" fill priority sizes="45vw" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-forest/80 via-forest/10 to-transparent" />
        <div className="absolute inset-x-10 bottom-10 text-white">
          <p className="font-display text-3xl font-extrabold leading-tight text-balance">
            Ihre Immobilie. Ihr Verkauf. Ohne Umwege.
          </p>
          <p className="mt-3 max-w-md text-white/85">
            Erfassen, bewerten, präsentieren und Interessenten verwalten – alles an einem Ort und kostenlos.
          </p>
        </div>
      </aside>
    </div>
  );
}
