"use client";

import { BadgeCheck, Ban, ShieldMinus, ShieldPlus, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionDialog, VerificationDialog } from "@/components/admin/action-dialog";
import { setUserRoleAction, setUserStatusAction, setVerificationAction } from "@/app/admin/actions";
import { APP_ROLES, type AppRole, type UserStatus } from "@/lib/validation/admin";

export function UserStatusAction({ userId, displayName, status }: { userId: string; displayName: string; status: UserStatus }) {
  if (status === "suspended") {
    return (
      <ActionDialog
        trigger={
          <Button variant="outline" className="w-full justify-start">
            <Unlock aria-hidden /> Sperre aufheben
          </Button>
        }
        title={`Sperre von ${displayName} aufheben?`}
        description="Die Person kann wieder Inserate veröffentlichen, Anfragen senden und Nachrichten schreiben. Pausierte Inserate muss sie selbst wieder aktivieren."
        reason={{ label: "Notiz", placeholder: "z. B. Sachverhalt geklärt" }}
        confirmLabel="Sperre aufheben"
        onConfirm={(reason) => setUserStatusAction({ userId, status: "active", reason })}
      />
    );
  }
  return (
    <ActionDialog
      trigger={
        <Button variant="outline" className="w-full justify-start text-destructive hover:bg-destructive-bg">
          <Ban aria-hidden /> Benutzer sperren
        </Button>
      }
      title={`${displayName} sperren?`}
      description="Veröffentlichte Inserate werden pausiert. Die Person kann sich weiterhin anmelden und ihre Daten exportieren, aber nichts mehr veröffentlichen, anfragen oder schreiben."
      reason={{ label: "Begründung", required: true, placeholder: "z. B. Betrugsverdacht nach mehreren Meldungen" }}
      confirmLabel="Sperren"
      destructive
      onConfirm={(reason) => setUserStatusAction({ userId, status: "suspended", reason })}
    />
  );
}

export function UserRoleActions({ userId, displayName, roles, isSelf }: { userId: string; displayName: string; roles: AppRole[]; isSelf: boolean }) {
  return (
    <div className="grid gap-2">
      {(["moderator", "admin"] as const).map((role) => {
        const has = roles.includes(role);
        if (has && isSelf) {
          return (
            <p key={role} className="rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
              Ihre eigene Rolle «{APP_ROLES[role].label}» können Sie nicht entziehen.
            </p>
          );
        }
        return (
          <ActionDialog
            key={role}
            trigger={
              <Button variant="outline" className="w-full justify-start">
                {has ? <ShieldMinus aria-hidden /> : <ShieldPlus aria-hidden />}
                {has ? `Rolle «${APP_ROLES[role].label}» entziehen` : `Rolle «${APP_ROLES[role].label}» vergeben`}
              </Button>
            }
            title={has ? `Rolle «${APP_ROLES[role].label}» entziehen?` : `${displayName} die Rolle «${APP_ROLES[role].label}» geben?`}
            description={
              has
                ? "Die Person verliert sofort den Zugriff auf die entsprechenden Bereiche der Administration."
                : `${APP_ROLES[role].description} Vergeben Sie Rollen nur an vertrauenswürdige Personen.`
            }
            confirmLabel={has ? "Rolle entziehen" : "Rolle vergeben"}
            destructive={has}
            onConfirm={() => setUserRoleAction({ userId, role, grant: !has })}
          />
        );
      })}
    </div>
  );
}

export function IdentityVerificationAction({ userId, displayName, verified }: { userId: string; displayName: string; verified: boolean }) {
  return (
    <VerificationDialog
      trigger={
        <Button variant="outline" className="w-full justify-start">
          <BadgeCheck aria-hidden /> {verified ? "Identitätsprüfung ändern" : "Identität verifizieren"}
        </Button>
      }
      title={`Identität von ${displayName}`}
      description="Markieren Sie die Identität nur als verifiziert, wenn Sie sie tatsächlich geprüft haben (z. B. amtlicher Ausweis). Der Status ist öffentlich sichtbar."
      currentlyVerified={verified}
      methodPlaceholder="z. B. Ausweis per Videocall geprüft"
      onConfirm={({ status, method }) =>
        setVerificationAction({ subjectType: "user", subjectId: userId, kind: "identity", status, method })
      }
    />
  );
}
