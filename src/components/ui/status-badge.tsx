import { Badge } from "@/components/ui/badge";
import type { Tone } from "@/lib/constants";

const TONE_MAP: Record<Tone, "neutral" | "green" | "blue" | "amber" | "red" | "dark"> = {
  neutral: "neutral",
  green: "green",
  blue: "blue",
  amber: "amber",
  red: "red",
  dark: "dark",
};

export function StatusBadge({ label, tone, className }: { label: string; tone: Tone; className?: string }) {
  return (
    <Badge tone={TONE_MAP[tone]} className={className}>
      <span className="size-1.5 rounded-full bg-current opacity-70" aria-hidden />
      {label}
    </Badge>
  );
}
