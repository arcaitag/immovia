import { CONFIG } from "@/lib/config";

/** Schweizer Zahlenformat mit Apostroph als Tausendertrennzeichen (ohne Intl, überall gleich). */
export function formatNumber(value: number): string {
  const rounded = Math.round(value);
  return String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, "’").replace(/^/, rounded < 0 ? "-" : "");
}

export function formatPrice(
  listing: { price: number | null; price_on_request: boolean; offer_type: "sale" | "rent"; additional_costs?: number | null },
): string {
  if (listing.price_on_request || listing.price === null) return "Preis auf Anfrage";
  return listing.offer_type === "rent" ? `CHF ${formatNumber(listing.price)} / Monat` : `CHF ${formatNumber(listing.price)}`;
}

export function formatRooms(rooms: number | null): string | null {
  if (rooms === null) return null;
  return `${String(rooms).replace(/\.0$/, "")} Zimmer`;
}

export function formatArea(area: number | null): string | null {
  return area === null ? null : `${formatNumber(area)} m²`;
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  const today = new Date();
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (d.toDateString() === today.toDateString()) return time;
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear() === today.getFullYear() ? "" : d.getFullYear()} ${time}`.trim();
}

type ImageSize = "sm" | "md" | "lg";

/** URL eines Immobilienbilds (wie propertyImageUrl der Website). */
export function imageUrl(
  image: { display_path?: string | null; external_url?: string | null } | null | undefined,
  size: ImageSize = "md",
): string | null {
  if (!image) return null;
  if (image.external_url) {
    const width = size === "sm" ? 640 : size === "md" ? 1280 : 2048;
    return `${image.external_url.split("?")[0]}?w=${width}&q=75&auto=format&fit=crop`;
  }
  if (!image.display_path) return null;
  const path = `${image.display_path}-${size}.webp`.split("/").map(encodeURIComponent).join("/");
  return `${CONFIG.supabaseUrl}/storage/v1/object/public/property-images/${path}`;
}

/** Zahl aus einem Eingabefeld («1’250’000», «4.5», «4,5») oder null. */
export function parseNumber(input: string): number | null {
  const cleaned = input.replace(/[’'\s]/g, "").replace(",", ".");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}
