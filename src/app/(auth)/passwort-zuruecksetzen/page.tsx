import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ResetPasswordForm } from "@/components/auth/auth-forms";
import { getSessionUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Neues Passwort festlegen", robots: { index: false } };

export default async function ResetPasswordPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?fehler=link");
  return (
    <div className="grid gap-8">
      <div className="grid gap-2">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Neues Passwort festlegen</h1>
        <p className="text-muted-foreground">Wählen Sie ein sicheres Passwort für {user.email}.</p>
      </div>
      <ResetPasswordForm />
    </div>
  );
}
