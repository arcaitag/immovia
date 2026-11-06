"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Crown, UserMinus } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
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
import { changeMemberRoleAction, removeMemberAction, transferOwnershipAction } from "@/app/dashboard/firma/actions";
import { ASSIGNABLE_ORG_ROLES, ORG_ROLES, type OrgRole } from "@/lib/validation/organization";
import { formatDate } from "@/lib/format";
import type { ActionResult } from "@/lib/errors";

export interface MemberItem {
  userId: string;
  role: OrgRole;
  displayName: string;
  avatarUrl: string | null;
  email: string | null;
  joinedAt: string | null;
  isMe: boolean;
}

export function MembersList({
  organizationId,
  members,
  myRole,
}: {
  organizationId: string;
  members: MemberItem[];
  myRole: OrgRole;
}) {
  const canManage = myRole === "owner" || myRole === "admin";
  return (
    <ul className="divide-y divide-border">
      {members.map((member) => (
        <MemberRow key={member.userId} organizationId={organizationId} member={member} canManage={canManage} isOwner={myRole === "owner"} />
      ))}
    </ul>
  );
}

function MemberRow({
  organizationId,
  member,
  canManage,
  isOwner,
}: {
  organizationId: string;
  member: MemberItem;
  canManage: boolean;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [role, setRole] = React.useState<OrgRole>(member.role);
  const editable = canManage && member.role !== "owner" && !member.isMe;

  function run(action: () => Promise<ActionResult<null>>, onError?: () => void) {
    startTransition(async () => {
      const res = await action();
      if (!res.ok) {
        onError?.();
        toast.error(res.error);
        return;
      }
      toast.success(res.message ?? "Gespeichert.");
      router.refresh();
    });
  }

  return (
    <li className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between" aria-busy={pending || undefined}>
      <div className="flex min-w-0 items-center gap-3">
        <Avatar src={member.avatarUrl} name={member.displayName} className="size-10" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            {member.displayName}
            {member.isMe ? <span className="ml-1.5 font-normal text-muted-foreground">(Sie)</span> : null}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {member.email ?? ORG_ROLES[member.role].label}
            {member.joinedAt ? ` · seit ${formatDate(member.joinedAt)}` : ""}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        {editable ? (
          <NativeSelect
            aria-label={`Rolle von ${member.displayName}`}
            value={role}
            disabled={pending}
            className="h-10 w-48"
            onChange={(event) => {
              const next = event.target.value as (typeof ASSIGNABLE_ORG_ROLES)[number];
              const previous = role;
              setRole(next);
              run(() => changeMemberRoleAction({ organizationId, userId: member.userId, role: next }), () => setRole(previous));
            }}
          >
            {ASSIGNABLE_ORG_ROLES.map((role) => (
              <option key={role} value={role}>
                {ORG_ROLES[role].label}
              </option>
            ))}
          </NativeSelect>
        ) : (
          <StatusBadge label={ORG_ROLES[member.role].label} tone={ORG_ROLES[member.role].tone} />
        )}
        {isOwner && member.role !== "owner" ? (
          <ConfirmButton
            icon={<Crown aria-hidden />}
            label="Zum Inhaber machen"
            title={`Inhaberschaft an ${member.displayName} übertragen?`}
            description="Die Person erhält volle Verwaltungsrechte inklusive Inhaberwechsel. Sie selbst werden Administrator/in und bleiben Mitglied."
            confirmLabel="Inhaberschaft übertragen"
            disabled={pending}
            onConfirm={() => run(() => transferOwnershipAction({ organizationId, userId: member.userId }))}
          />
        ) : null}
        {editable ? (
          <ConfirmButton
            icon={<UserMinus aria-hidden />}
            label="Entfernen"
            title={`${member.displayName} entfernen?`}
            description="Die Person verliert den Zugriff auf das Firmenkonto und die Immobilien der Firma. Ihre eigenen Daten bleiben erhalten."
            confirmLabel="Mitglied entfernen"
            destructive
            disabled={pending}
            onConfirm={() => run(() => removeMemberAction({ organizationId, userId: member.userId }))}
          />
        ) : null}
      </div>
    </li>
  );
}

function ConfirmButton({
  icon,
  label,
  title,
  description,
  confirmLabel,
  destructive,
  disabled,
  onConfirm,
}: {
  icon: React.ReactNode;
  label: string;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  disabled?: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm" disabled={disabled} className={destructive ? "text-destructive hover:bg-destructive-bg" : undefined}>
          {icon} {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
          <AlertDialogAction destructive={destructive} onClick={onConfirm}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
