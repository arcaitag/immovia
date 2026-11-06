"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { toast } from "@/components/ui/sonner";
import { acceptInvitationAction, switchAccountAction } from "@/app/einladung/[token]/actions";

export function AcceptInvitationButton({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function onAccept() {
    setError(null);
    startTransition(async () => {
      const res = await acceptInvitationAction(token);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(res.message ?? "Einladung angenommen.");
      router.replace(`/dashboard/firma?firma=${res.data.organizationId}`);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-3">
      {error ? <Alert tone="error">{error}</Alert> : null}
      <Button size="lg" onClick={onAccept} loading={pending}>
        <Check aria-hidden /> Einladung annehmen
      </Button>
    </div>
  );
}

export function SwitchAccountButton({ token }: { token: string }) {
  const [pending, startTransition] = React.useTransition();
  return (
    <Button
      variant="outline"
      size="lg"
      loading={pending}
      onClick={() => startTransition(() => switchAccountAction(token))}
    >
      <LogOut aria-hidden /> Mit anderem Konto anmelden
    </Button>
  );
}
