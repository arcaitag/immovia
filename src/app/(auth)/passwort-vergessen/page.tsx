import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Passwort vergessen", robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <div className="grid gap-8">
      <div className="grid gap-2">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Passwort vergessen?</h1>
        <p className="text-muted-foreground">Wir senden Ihnen einen Link, mit dem Sie ein neues Passwort festlegen können.</p>
      </div>
      <ForgotPasswordForm />
      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-semibold text-primary hover:underline">
          Zurück zur Anmeldung
        </Link>
      </p>
    </div>
  );
}
