"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Building2, ImageUp, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { imagePreparationMessage, prepareImageForUpload } from "@/components/account/image-file";
import { removeOrganizationLogoAction, uploadOrganizationLogoAction } from "@/app/dashboard/firma/actions";
import { IMAGE_SOURCE_TYPES } from "@/lib/validation/account";

export function OrganizationLogo({ url, name, className }: { url: string | null; name: string; className?: string }) {
  return (
    <div
      className={`relative flex size-32 items-center justify-center overflow-hidden rounded-2xl border border-border bg-white ${className ?? ""}`}
    >
      {url ? (
        <Image src={url} alt={`Logo ${name}`} fill sizes="128px" className="object-contain p-3" />
      ) : (
        <Building2 className="size-10 text-muted-foreground/60" aria-hidden />
      )}
    </div>
  );
}

export function LogoUpload({ organizationId, name, logoUrl }: { organizationId: string; name: string; logoUrl: string | null }) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [preview, setPreview] = React.useState<string | null>(logoUrl);
  const [busy, setBusy] = React.useState<"upload" | "remove" | null>(null);

  async function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy("upload");
    try {
      let blob: Blob;
      try {
        blob = await prepareImageForUpload(file, { maxSize: 1024, preferTransparency: true });
      } catch (error) {
        toast.error(imagePreparationMessage(error));
        return;
      }
      const formData = new FormData();
      formData.set("organizationId", organizationId);
      formData.set("file", blob, "logo");
      const res = await uploadOrganizationLogoAction(formData);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setPreview(res.data.logoUrl);
      toast.success(res.message ?? "Gespeichert.");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function onRemove() {
    setBusy("remove");
    const res = await removeOrganizationLogoAction({ organizationId });
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
      <OrganizationLogo url={preview} name={name} />
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
          <ImageUp aria-hidden /> {preview ? "Neues Logo wählen" : "Logo hochladen"}
        </Button>
        {preview ? (
          <Button type="button" variant="ghost" size="sm" loading={busy === "remove"} disabled={busy !== null} onClick={onRemove}>
            <Trash aria-hidden /> Logo entfernen
          </Button>
        ) : null}
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">PNG mit transparentem Hintergrund, JPG oder WebP.</p>
    </div>
  );
}
