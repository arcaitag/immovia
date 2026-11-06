"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ImageUp, Trash } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { imagePreparationMessage, prepareImageForUpload } from "@/components/account/image-file";
import { removeAvatarAction, uploadAvatarAction } from "@/app/dashboard/profil/actions";
import { IMAGE_SOURCE_TYPES } from "@/lib/validation/account";

export function AvatarUpload({ avatarUrl, displayName }: { avatarUrl: string | null; displayName: string }) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [preview, setPreview] = React.useState<string | null>(avatarUrl);
  const [busy, setBusy] = React.useState<"upload" | "remove" | null>(null);

  async function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy("upload");
    try {
      let blob: Blob;
      try {
        blob = await prepareImageForUpload(file, { maxSize: 768 });
      } catch (error) {
        toast.error(imagePreparationMessage(error));
        return;
      }
      const formData = new FormData();
      formData.set("file", blob, "avatar");
      const res = await uploadAvatarAction(formData);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setPreview(res.data.avatarUrl);
      toast.success(res.message ?? "Gespeichert.");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function onRemove() {
    setBusy("remove");
    const res = await removeAvatarAction();
    setBusy(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setPreview(null);
    toast.success(res.message ?? "Entfernt.");
    router.refresh();
  }

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <Avatar src={preview} name={displayName} className="size-28 text-2xl [&_span]:text-2xl" />
      <input
        ref={inputRef}
        type="file"
        accept={IMAGE_SOURCE_TYPES.join(",")}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={onFileChange}
      />
      <div className="flex w-full flex-col gap-2">
        <Button type="button" variant="outline" loading={busy === "upload"} disabled={busy !== null} onClick={() => inputRef.current?.click()}>
          <ImageUp aria-hidden /> {preview ? "Neues Bild wählen" : "Bild hochladen"}
        </Button>
        {preview ? (
          <Button type="button" variant="ghost" size="sm" loading={busy === "remove"} disabled={busy !== null} onClick={onRemove}>
            <Trash aria-hidden /> Bild entfernen
          </Button>
        ) : null}
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        JPG, PNG oder WebP. Das Bild wird quadratisch zugeschnitten und ohne Standortdaten gespeichert.
      </p>
    </div>
  );
}
