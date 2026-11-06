import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/auth/auth-forms";
import { safeRedirectPath } from "@/lib/validation/auth";

export const metadata: Metadata = { title: "Anmelden", robots: { index: false } };

const NOTICES: Record<string, string> = {
  bestaetigt: "Ihre E-Mail-Adresse ist bestätigt. Sie können sich jetzt anmelden.",
  abgemeldet: "Sie wurden abgemeldet.",
  passwort: "Ihr Passwort wurde geändert. Bitte melden Sie sich an.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const next = safeRedirectPath(params.weiter);
  const notice = params.hinweis ? NOTICES[params.hinweis] : undefined;
  const error = params.fehler === "link" ? "Der Link ist ungültig oder abgelaufen. Bitte versuchen Sie es erneut." : undefined;
  return (
    <div className="grid gap-8">
      <div className="grid gap-2">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Willkommen zurück</h1>
        <p className="text-muted-foreground">Melden Sie sich an, um Ihre Immobilien, Nachrichten und Termine zu verwalten.</p>
      </div>
      <LoginForm next={next} notice={notice ?? error} />
      <p className="text-center text-sm text-muted-foreground">
        Noch kein Konto?{" "}
        <Link href={`/registrieren?weiter=${encodeURIComponent(next)}`} className="font-semibold text-primary hover:underline">
          Kostenlos registrieren
        </Link>
      </p>
    </div>
  );
}
