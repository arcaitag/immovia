import type { ImageAiCapability, StagingRoomType, StagingStyle } from "@/lib/images/ai-providers/types";

/**
 * Anweisungen an das Bildmodell (Englisch, weil die Modelle damit am zuverlässigsten arbeiten).
 * Grundsatz: Es entsteht ein Vorschlag desselben Raums. Alles Bauliche, die Aussicht und allfällige
 * Mängel bleiben unverändert, damit das Bild die Immobilie nicht falsch darstellt.
 */

const ROOM_NAMES: Record<StagingRoomType, string> = {
  living_room: "living room",
  bedroom: "bedroom",
  dining_room: "dining room",
  kitchen: "kitchen",
  office: "home office",
  children_room: "children's room",
};

const STYLE_DESCRIPTIONS: Record<StagingStyle, string> = {
  modern: "modern: clean lines, light neutral colours with warm wood accents, a few green plants",
  scandinavian: "Scandinavian: light oak, white and soft grey textiles, natural materials, cosy and uncluttered",
  classic: "classic: timeless upholstered furniture, warm muted colours, elegant but not ornate",
  minimal: "minimalist: only a few essential pieces, calm neutral palette, lots of free space",
};

const KEEP_UNCHANGED =
  "Keep exactly the same room, camera position, perspective, framing and lens. " +
  "Do NOT change any of the following: walls and their colour, ceiling, floor material and colour, windows and window frames, doors, " +
  "built-in kitchen units and appliances, bathroom fixtures, radiators, light switches and sockets, the view through the windows, " +
  "the size and shape of the room. Do not add or remove windows, doors or walls. " +
  "Keep any visible damage or wear (for example cracks, stains or moisture marks) exactly as it is.";

const PHOTO_STYLE =
  "The result must look like a natural, photorealistic photograph of this exact property: even, neutral daylight, true colours, " +
  "no HDR look, no illustration, no text, no watermark, no people.";

/** Baut die Anweisung für eine Fähigkeit. Wirft bei Fähigkeiten ohne Designvorschlag. */
export function buildImageAiPrompt(
  capability: ImageAiCapability,
  options: { roomType?: StagingRoomType; style?: StagingStyle } = {},
): string {
  switch (capability) {
    case "declutter":
      return [
        "Edit this real-estate photo so the room looks clean and tidy, ready for a property listing.",
        KEEP_UNCHANGED,
        "Remove clutter and personal items: loose objects on floors, tables, shelves and counters, cables, laundry, toiletries, papers, " +
          "bags, shoes, toys, waste bins, magnets and notes, and personal photos.",
        "Keep the existing furniture where it is; only tidy it (straighten cushions, blankets and curtains, make the bed neatly). " +
          "Do not add any new furniture or decoration.",
        PHOTO_STYLE,
      ].join("\n\n");
    case "virtual_staging": {
      const room = ROOM_NAMES[options.roomType ?? "living_room"];
      const style = STYLE_DESCRIPTIONS[options.style ?? "modern"];
      return [
        `Edit this real-estate photo of a ${room} into an interior design proposal in a ${style} style.`,
        KEEP_UNCHANGED,
        "Replace only movable furniture, rugs, curtains, lamps and decoration; if the room is empty, furnish it. " +
          `Choose pieces that suit a ${room}, are true to scale for the room and keep doors, windows and walkways free.`,
        PHOTO_STYLE,
      ].join("\n\n");
    }
    case "perspective":
      return [
        "Correct the perspective of this real-estate photo so that vertical lines are straight and parallel.",
        "Do not change anything else in the image: same content, colours, light and objects.",
        PHOTO_STYLE,
      ].join("\n\n");
  }
}
