"use client";

import { Toaster as Sonner, toast } from "sonner";

export function Toaster() {
  return (
    <Sonner
      position="top-center"
      closeButton
      toastOptions={{
        classNames: {
          toast: "!rounded-xl !border !border-border !bg-card !text-foreground !shadow-float !font-sans",
          description: "!text-muted-foreground",
          success: "[&_[data-icon]]:!text-brand",
          error: "[&_[data-icon]]:!text-destructive",
        },
      }}
    />
  );
}

export { toast };
