import type { Metadata } from "next";
import Link from "next/link";
import { RegisterForm } from "@/components/auth/auth-forms";
import { safeRedirectPath } from "@/lib/validation/auth";

export const metadata: Metadata = {
  title: "Kostenlos registrieren",
  description: "Erstellen Sie Ihr kostenloses Immovia-Konto, um Immobilien zu inserieren, zu bewerten und Interessenten zu verwalten.",
};

export default async function RegisterPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const next = safeRedirectPath(params.weiter);
  return (
    <div className="grid gap-8">
      <div className="grid gap-2">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Kostenlos starten</h1>
        <p className="text-muted-foreground">
          Ein Konto für alles: Immobilie verkaufen oder vermieten, Inserate merken und Besichtigungen vereinbaren.
        </p>
      </div>
      <RegisterForm next={next} />
      <p className="text-center text-sm text-muted-foreground">
        Bereits registriert?{" "}
        <Link href={`/login?weiter=${encodeURIComponent(next)}`} className="font-semibold text-primary hover:underline">
          Anmelden
        </Link>
      </p>
    </div>
  );
}
