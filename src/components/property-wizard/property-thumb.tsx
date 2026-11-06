import Image from "next/image";
import { ImageOff } from "lucide-react";
import { propertyImageUrl } from "@/lib/storage";
import { cn } from "@/lib/utils";

/** Kleines Titelbild einer Immobilie (oder Platzhalter). */
export function PropertyThumb({
  image,
  alt,
  className,
  sizes = "96px",
}: {
  image: { display_path: string | null; external_url: string | null } | null;
  alt: string;
  className?: string;
  sizes?: string;
}) {
  const src = propertyImageUrl(image, "sm");
  return (
    <div className={cn("relative shrink-0 overflow-hidden rounded-xl bg-muted", className)}>
      {src ? (
        <Image src={src} alt={alt} fill sizes={sizes} className="object-cover" />
      ) : (
        <div className="flex size-full items-center justify-center text-muted-foreground">
          <ImageOff className="size-5" aria-hidden />
          <span className="sr-only">Noch kein Bild</span>
        </div>
      )}
    </div>
  );
}
