"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/components/ui/sonner";
import { leaveOrganizationAction } from "@/app/dashboard/firma/actions";

export function LeaveOrganizationButton({ organizationId, organizationName }: { organizationId: string; organizationName: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function onLeave() {
    startTransition(async () => {
      const res = await leaveOrganizationAction({ organizationId });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message ?? "Erledigt.");
      router.replace("/dashboard/firma");
      router.refresh();
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" className="w-full" loading={pending}>
          <LogOut aria-hidden /> Firmenkonto verlassen
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>«{organizationName}» verlassen?</AlertDialogTitle>
          <AlertDialogDescription>
            Sie verlieren den Zugriff auf das Firmenkonto und die Immobilien der Firma. Für einen erneuten Beitritt
            benötigen Sie eine neue Einladung.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
          <AlertDialogAction destructive onClick={onLeave}>
            Verlassen
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
