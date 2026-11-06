"use client";

import * as React from "react";
import { NativeSelect } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { useAdminAction } from "@/components/admin/action-dialog";
import { updateContactRequestAction } from "@/app/admin/actions";
import { CONTACT_STATUS, type ContactStatus } from "@/lib/validation/admin";

export function ContactStatusSelect({ requestId, status, label }: { requestId: string; status: ContactStatus; label: string }) {
  const { pending, run } = useAdminAction();
  const [value, setValue] = React.useState<ContactStatus>(status);
  return (
    <NativeSelect
      aria-label={label}
      value={value}
      disabled={pending}
      className="h-10"
      onChange={(event) => {
        const next = event.target.value as ContactStatus;
        const previous = value;
        setValue(next);
        run(() => updateContactRequestAction({ requestId, status: next }), {
          onError: (res) => {
            setValue(previous);
            toast.error(res.error);
          },
        });
      }}
    >
      {(Object.keys(CONTACT_STATUS) as ContactStatus[]).map((s) => (
        <option key={s} value={s}>
          {CONTACT_STATUS[s].label}
        </option>
      ))}
    </NativeSelect>
  );
}
