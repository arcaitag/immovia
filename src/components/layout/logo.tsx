import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" aria-hidden className={cn("size-9", className)}>
      <path
        d="M6.5 18.2 20 6.5l13.5 11.7V31a2.5 2.5 0 0 1-2.5 2.5H9A2.5 2.5 0 0 1 6.5 31V18.2Z"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinejoin="round"
      />
      <path d="M15.5 33.5v-8.2a4.5 4.5 0 0 1 9 0v8.2" stroke="currentColor" strokeWidth="3.2" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2 rounded-lg", className)} aria-label="Immovia – zur Startseite">
      <LogoMark className="text-brand" />
      <span className="font-display text-[1.6rem] font-extrabold leading-none tracking-tight text-forest">
        Immo<span className="text-brand">via</span>
      </span>
    </Link>
  );
}
