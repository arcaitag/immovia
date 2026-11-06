"use client";

import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { toast } from "@/components/ui/sonner";
import { updateNotificationSettingsAction } from "@/app/dashboard/einstellungen/actions";
import {
  NOTIFICATION_SETTINGS,
  notificationSettingsSchema,
  type NotificationSettingsValues,
} from "@/lib/validation/account";

export function NotificationSettingsForm({ defaultValues }: { defaultValues: NotificationSettingsValues }) {
  const [formError, setFormError] = React.useState<string | null>(null);
  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting, isDirty },
  } = useForm<NotificationSettingsValues>({ resolver: zodResolver(notificationSettingsSchema), defaultValues });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const res = await updateNotificationSettingsAction(values);
    if (!res.ok) {
      setFormError(res.error);
      return;
    }
    reset(values);
    toast.success(res.message ?? "Gespeichert.");
  });

  return (
    <form onSubmit={onSubmit} className="grid gap-2" noValidate>
      {formError ? <Alert tone="error">{formError}</Alert> : null}
      <ul className="divide-y divide-border">
        {NOTIFICATION_SETTINGS.map((item) => (
          <li key={item.key}>
            <Controller
              control={control}
              name={item.key}
              render={({ field }) => (
                <div className="flex items-start justify-between gap-4 py-4">
                  <div className="grid gap-1">
                    <Label htmlFor={`benachrichtigung-${item.key}`} className="cursor-pointer">
                      {item.label}
                    </Label>
                    <p id={`benachrichtigung-${item.key}-hint`} className="text-xs leading-relaxed text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                  <Switch
                    id={`benachrichtigung-${item.key}`}
                    aria-describedby={`benachrichtigung-${item.key}-hint`}
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    onBlur={field.onBlur}
                    ref={field.ref}
                    className="mt-0.5"
                  />
                </div>
              )}
            />
          </li>
        ))}
      </ul>
      <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-relaxed text-muted-foreground">
          Mitteilungen im Dashboard und sicherheitsrelevante E-Mails (z. B. Passwortänderung) erhalten Sie immer.
        </p>
        <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
          Speichern
        </Button>
      </div>
    </form>
  );
}
