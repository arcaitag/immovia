import { z } from "zod";
import { AppError } from "@/lib/errors";
import { DESCRIPTION_STYLES, type DescriptionStyle } from "@/lib/constants";
import { buildPropertyFacts } from "@/lib/ai/property-facts";
import { DESCRIPTION_SECTIONS, DESCRIPTION_SECTION_KEYS, parseStoredDescription, type DescriptionSectionKey } from "@/lib/ai/prompts/description";
import { getFeatureAvailability, requireManagedProperty } from "@/services/ai/access";
import { requestDescriptionJob } from "@/services/ai/descriptions";
import { loadPropertyContext } from "@/services/ai/property-data";
import { readJson, withSession } from "../valuation/_lib";

export const runtime = "nodejs";
// Wie die Beschreibungsseite der Website: der Auftrag läuft nach der Antwort weiter (after)
export const maxDuration = 300;

const querySchema = z.object({ propertyId: z.guid(), versionId: z.guid().optional() });

type SectionValue = string | string[];

/** Wie DescriptionFacts auf der Website: Wert einer Angabe als Text. */
function formatFact(value: unknown): string {
  if (value === null || value === undefined) return "–";
  if (Array.isArray(value)) return value.map((item) => formatFact(item)).join(", ");
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>)
      .filter((v) => v !== null && v !== undefined && v !== "")
      .map((v) => formatFact(v))
      .join(" ");
  }
  return String(value);
}

/**
 * Mobile App: Stand der KI-Inseratetexte – dieselben Daten wie die Seite
 * /dashboard/immobilien/[id]/beschreibung (Verfügbarkeit/Kontingent/Einwilligung, gewählte Version,
 * Versionsverlauf, aktuelle Texte im Inserat, Bestätigung der Texte, an die KI übermittelte Angaben).
 */
export async function GET(request: Request) {
  return withSession(request, async ({ supabase, user }) => {
    const url = new URL(request.url);
    const parsed = querySchema.safeParse({
      propertyId: url.searchParams.get("propertyId") ?? "",
      versionId: url.searchParams.get("versionId") ?? undefined,
    });
    if (!parsed.success) throw new AppError("validation", "Ungültige Anfrage.");
    const property = await requireManagedProperty(supabase, user, parsed.data.propertyId);

    const [versionsRes, context, availability, listingRes] = await Promise.all([
      supabase
        .from("generated_descriptions")
        .select("id, style, content, model, applied_at, created_at")
        .eq("property_id", property.id)
        .order("created_at", { ascending: false })
        .limit(30),
      loadPropertyContext(supabase, property.id),
      getFeatureAvailability({
        supabase,
        userId: user.id,
        flag: "ai_descriptions",
        quotaFeature: "description",
        requiresAi: true,
        requiresConsent: true,
      }),
      supabase
        .from("listings")
        .select("id, status, title, short_description, description, location_description, equipment_description, highlights, search_summary, texts_confirmed_at")
        .eq("property_id", property.id)
        .is("deleted_at", null)
        .neq("status", "archived")
        .maybeSingle(),
    ]);

    const rows = versionsRes.data ?? [];
    const selectedRow =
      rows.find((row) => row.id === parsed.data.versionId) ?? rows.find((row) => !parseStoredDescription(row.content).rephrasedSection) ?? rows[0] ?? null;

    let version = null;
    if (selectedRow) {
      const stored = parseStoredDescription(selectedRow.content);
      version = {
        id: selectedRow.id,
        style: selectedRow.style,
        createdAt: selectedRow.created_at,
        model: selectedRow.model,
        content: Object.fromEntries(DESCRIPTION_SECTION_KEYS.map((key) => [key, stored[key]])) as Record<DescriptionSectionKey, SectionValue>,
        rephrasedSection: stored.rephrasedSection ?? null,
      };
    }
    const history = rows.map((row) => ({
      id: row.id,
      style: row.style,
      createdAt: row.created_at,
      appliedAt: row.applied_at,
      rephrasedSection: parseStoredDescription(row.content).rephrasedSection ?? null,
    }));

    const listing = listingRes.data ?? null;
    const listingTexts = Object.fromEntries(
      DESCRIPTION_SECTION_KEYS.map((key) => [key, listing ? (listing[DESCRIPTION_SECTIONS[key].listingColumn] ?? null) : null]),
    ) as Record<DescriptionSectionKey, SectionValue | null>;
    const facts = context ? buildPropertyFacts({ property: context.property, featureKeys: context.featureKeys, renovations: context.renovations }) : {};

    return {
      availability,
      styles: (Object.keys(DESCRIPTION_STYLES) as DescriptionStyle[]).map((key) => ({ key, ...DESCRIPTION_STYLES[key] })),
      sections: DESCRIPTION_SECTION_KEYS.map((key) => ({
        key,
        label: DESCRIPTION_SECTIONS[key].label,
        hint: DESCRIPTION_SECTIONS[key].hint,
        max: DESCRIPTION_SECTIONS[key].max,
        rows: DESCRIPTION_SECTIONS[key].rows,
      })),
      version,
      history,
      listingTexts,
      confirmation: {
        hasListing: Boolean(listing),
        confirmedAt: listing?.texts_confirmed_at ?? null,
        canConfirm: Boolean(listing?.title?.trim() && listing.description?.trim()),
      },
      facts: Object.entries(facts).map(([label, value]) => ({ label, value: formatFact(value) })),
    };
  });
}

/**
 * Texte erstellen bzw. einen Abschnitt neu formulieren (Hintergrundauftrag). Der Body entspricht
 * requestDescriptionSchema; geprüft wird im Dienst. Fehlt die Einwilligung: consentRequired: true.
 */
export async function POST(request: Request) {
  return withSession(request, async ({ supabase, user }) => requestDescriptionJob(supabase, user, await readJson(request)));
}
