import * as React from "react";
import { Document, Image, Page, Path, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import { DOCUMENT_CATEGORIES, OFFER_TYPES, type DocumentCategory } from "@/lib/constants";
import { formatDateLong, formatPhone } from "@/lib/format";
import { ensurePdfFonts, type PdfFonts } from "@/lib/pdf/fonts";
import type { PdfTheme } from "@/lib/pdf/theme";
import type { DossierContent, PdfImage } from "@/lib/pdf/dossier/types";
import type { DossierTemplateId } from "@/lib/pdf/dossier/options";

/**
 * Verkaufsdossier als PDF (@react-pdf/renderer).
 * Vorlagen: modern (Weiss/Hellgrün, Kacheln), premium (grossflächige Fotografie,
 * reduzierte Typografie), classic (sachlich, Tabellen).
 * Es werden nur vorhandene Inhalte gezeigt – leere Abschnitte entfallen.
 *
 * Hinweise zu react-pdf:
 * - Abschnittstitel sind direkte Kinder der Seite, damit minPresenceAhead greift
 *   (verhindert Titel allein am Seitenende).
 * - Keine lineHeight auf <Page>: sonst werden fixierte Elemente mit render-Prop
 *   (Seitenzahlen) nicht gezeichnet. Die Zeilenhöhe steht an den Textstilen.
 * - Deckblätter ohne wrap={false} (sonst wird die Seitenhöhe inhaltsabhängig); vollflächige
 *   Elemente bleiben knapp unter der Seitenhöhe, sonst entsteht eine leere Folgeseite.
 */

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const LH = 1.5;

function buildStyles(theme: PdfTheme, fonts: PdfFonts, template: DossierTemplateId) {
  const marginX = template === "premium" ? 60 : 50;
  return StyleSheet.create({
    page: {
      ...fonts.body(400),
      backgroundColor: theme.background,
      color: theme.text,
      fontSize: 10,
      paddingTop: template === "classic" ? 58 : 36,
      paddingBottom: 72,
      paddingHorizontal: marginX,
    },
    coverPage: { ...fonts.body(400), backgroundColor: theme.background, color: theme.text, padding: 0 },
    header: {
      position: "absolute",
      top: 28,
      left: marginX,
      right: marginX,
      flexDirection: "row",
      justifyContent: "space-between",
      borderBottomWidth: 1,
      borderBottomColor: theme.heading,
      paddingBottom: 5,
    },
    headerText: { ...fonts.body(600), fontSize: 8, color: theme.heading },
    footer: {
      position: "absolute",
      bottom: 30,
      left: marginX,
      right: marginX,
      flexDirection: "row",
      justifyContent: "space-between",
      borderTopWidth: 0.5,
      borderTopColor: theme.border,
      paddingTop: 8,
    },
    footerText: { fontSize: 7.5, color: theme.muted },
    previewMark: { ...fonts.body(700), fontSize: 7.5, color: theme.accent, letterSpacing: 1 },
    // Abschnittstitel (direkte Kinder der Seite)
    sectionHead: { marginTop: template === "premium" ? 30 : 24, marginBottom: 11 },
    sectionBar: { width: 26, height: 3, borderRadius: 2, backgroundColor: theme.accent, marginBottom: 7 },
    sectionEyebrow: { ...fonts.body(600), fontSize: 7.5, color: theme.accent, letterSpacing: 1.6, marginBottom: 4 },
    sectionTitle: {
      ...fonts.display(800),
      fontSize: template === "premium" ? 19 : template === "classic" ? 13.5 : 16,
      color: theme.heading,
      lineHeight: 1.25,
    },
    classicTitleWrap: { borderBottomWidth: 1, borderBottomColor: theme.heading, paddingBottom: 5 },
    paragraph: { marginBottom: 8, lineHeight: LH },
    lead: { fontSize: 11.5, lineHeight: 1.6, color: theme.text, marginBottom: 12 },
    text: { lineHeight: LH },
    small: { fontSize: 8.5, color: theme.muted, lineHeight: LH },
    // Listen
    bullets: { flexDirection: "row", flexWrap: "wrap", marginBottom: 4 },
    bulletRow: { flexDirection: "row", marginBottom: 5, paddingRight: 8 },
    bulletDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: theme.accent, marginTop: 5, marginRight: 8 },
    bulletText: { flex: 1, lineHeight: LH },
    halfCol: { width: "50%" },
    fullCol: { width: "100%" },
    // Eckdaten
    tiles: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4 },
    tileWrap: { width: "33.33%", padding: 4 },
    tile: { backgroundColor: theme.surface, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 11, minHeight: 48 },
    tileLabel: { ...fonts.body(600), fontSize: 7, color: theme.muted, letterSpacing: 0.6, marginBottom: 3 },
    tileValue: { ...fonts.body(700), fontSize: 10.5, color: theme.heading, lineHeight: 1.3 },
    factRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: theme.border, paddingVertical: 6 },
    factRowAlt: { backgroundColor: theme.surface === "#FFFFFF" ? "#F8FAF6" : theme.surface },
    factLabel: { width: "42%", color: theme.muted, paddingLeft: template === "classic" ? 6 : 0, lineHeight: 1.35 },
    factValue: { ...fonts.body(600), width: "58%", color: theme.text, lineHeight: 1.35 },
    // Bilder
    galleryRow: { flexDirection: "row", marginBottom: 10 },
    galleryCell: { flex: 1 },
    galleryCellLeft: { flex: 1, marginRight: 10 },
    galleryImage: { width: "100%", height: template === "classic" ? 165 : 178, objectFit: "cover", borderRadius: template === "classic" ? 0 : 8 },
    premiumImage: { width: "100%", height: 300, objectFit: "cover" },
    caption: { fontSize: 7.5, color: theme.muted, marginTop: 4, lineHeight: 1.3 },
    aiBadge: {
      ...fonts.body(700),
      position: "absolute",
      top: 8,
      left: 8,
      backgroundColor: theme.text,
      color: "#FFFFFF",
      fontSize: 7,
      paddingVertical: 2,
      paddingHorizontal: 6,
      borderRadius: 4,
    },
    floorPlanBlock: { marginBottom: 18 },
    floorPlan: { width: "100%", height: 470, objectFit: "contain" },
    // Kontakt
    contactCard: {
      flexDirection: "row",
      backgroundColor: theme.surface === "#FFFFFF" ? "#F8FAF6" : theme.surface,
      borderRadius: template === "classic" ? 0 : 12,
      borderWidth: template === "classic" ? 1 : 0,
      borderColor: theme.border,
      padding: 18,
    },
    contactName: { ...fonts.display(800), fontSize: 14, color: theme.heading, marginBottom: 4 },
    qr: { width: 92, height: 92 },
    disclaimer: { fontSize: 7.5, color: theme.muted, marginTop: 16, lineHeight: LH },
  });
}

type Styles = ReturnType<typeof buildStyles>;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function paragraphs(text: string | null): string[] {
  if (!text) return [];
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function pdfSrc(image: PdfImage) {
  return { data: image.data, format: image.format };
}

function LogoMark({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <Path d="M6.5 18.2 20 6.5l13.5 11.7V31a2.5 2.5 0 0 1-2.5 2.5H9A2.5 2.5 0 0 1 6.5 31V18.2Z" stroke={color} strokeWidth={3.2} fill="none" />
      <Path d="M15.5 33.5v-8.2a4.5 4.5 0 0 1 9 0v8.2" stroke={color} strokeWidth={3.2} fill="none" />
    </Svg>
  );
}

function SectionTitle({
  s,
  eyebrow,
  title,
  template,
  breakBefore = false,
  presence = 64,
}: {
  s: Styles;
  eyebrow: string;
  title: string;
  template: DossierTemplateId;
  breakBefore?: boolean;
  /** Platz (pt), der nach dem Titel auf derselben Seite verfügbar sein muss */
  presence?: number;
}) {
  return (
    <View style={s.sectionHead} minPresenceAhead={presence} break={breakBefore}>
      {template === "modern" ? <View style={s.sectionBar} /> : null}
      {template === "premium" ? <Text style={s.sectionEyebrow}>{eyebrow.toUpperCase()}</Text> : null}
      <View style={template === "classic" ? s.classicTitleWrap : {}}>
        <Text style={s.sectionTitle}>{title}</Text>
      </View>
    </View>
  );
}

function Bullets({ s, items, columns = 1 }: { s: Styles; items: string[]; columns?: 1 | 2 }) {
  return (
    <View style={s.bullets}>
      {items.map((item, i) => (
        <View key={`${item}-${i}`} style={[s.bulletRow, columns === 2 ? s.halfCol : s.fullCol]} wrap={false}>
          <View style={s.bulletDot} />
          <Text style={s.bulletText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function KeyFacts({ s, facts, template }: { s: Styles; facts: DossierContent["keyFacts"]; template: DossierTemplateId }) {
  if (template === "modern") {
    return (
      <View style={s.tiles}>
        {facts.map((fact) => (
          <View key={fact.label} style={s.tileWrap} wrap={false}>
            <View style={s.tile}>
              <Text style={s.tileLabel}>{fact.label.toUpperCase()}</Text>
              <Text style={s.tileValue}>{fact.value}</Text>
            </View>
          </View>
        ))}
      </View>
    );
  }
  return (
    <View>
      {facts.map((fact, i) => (
        <View key={fact.label} style={[s.factRow, template === "classic" && i % 2 === 0 ? s.factRowAlt : {}]} wrap={false}>
          <Text style={s.factLabel}>{fact.label}</Text>
          <Text style={s.factValue}>{fact.value}</Text>
        </View>
      ))}
    </View>
  );
}

function GalleryImage({ s, image, style }: { s: Styles; image: PdfImage; style: Styles["galleryImage"] | Styles["premiumImage"] }) {
  return (
    <View>
      {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image hat kein alt-Attribut */}
      <Image src={pdfSrc(image)} style={style} />
      {image.isAiVisualization ? <Text style={s.aiBadge}>KI-Visualisierung</Text> : null}
      {image.caption ? <Text style={s.caption}>{image.caption}</Text> : null}
    </View>
  );
}

function Footer({ s, content }: { s: Styles; content: DossierContent }) {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>{content.isPreview ? "Vorschau – nicht zur Weitergabe" : "Verkaufsdokumentation · Immovia"}</Text>
      <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Seite ${pageNumber} von ${totalPages}`} />
    </View>
  );
}

function CoverModern({ s, content, fonts }: { s: Styles; content: DossierContent; fonts: PdfFonts }) {
  const t = content.theme;
  return (
    <Page size="A4" style={s.coverPage}>
      <View style={{ marginTop: 34, marginHorizontal: 34, height: 455, borderRadius: 18, overflow: "hidden", backgroundColor: t.mint }}>
        {content.cover ? (
          // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image hat kein alt-Attribut
          <Image src={pdfSrc(content.cover)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <LogoMark color={t.brand} size={96} />
          </View>
        )}
      </View>
      {content.cover?.isAiVisualization ? (
        <Text style={[s.aiBadge, { top: 46, left: 46 }]}>KI-Visualisierung</Text>
      ) : null}
      <View style={{ paddingHorizontal: 46, paddingTop: 30 }}>
        <Text style={{ ...fonts.body(700), fontSize: 8.5, color: t.accent, letterSpacing: 1.6 }}>
          {OFFER_TYPES[content.offerType].verb.toUpperCase()}
        </Text>
        <Text style={{ ...fonts.display(800), fontSize: 27, color: t.heading, lineHeight: 1.18, marginTop: 6, maxLines: 3, textOverflow: "ellipsis" }}>
          {content.title}
        </Text>
        <Text style={{ fontSize: 11.5, color: t.muted, marginTop: 8 }}>{content.locationLabel}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 20 }}>
          <View style={{ backgroundColor: t.mint, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 14, marginRight: 16 }}>
            <Text style={{ fontSize: 7.5, color: t.forest, letterSpacing: 0.8 }}>{content.priceLabel.toUpperCase()}</Text>
            <Text style={{ ...fonts.display(800), fontSize: 16, color: t.forest }}>{content.priceValue}</Text>
          </View>
          <Text style={{ fontSize: 10.5, color: t.text, flex: 1, lineHeight: LH }}>{content.subtitle}</Text>
        </View>
      </View>
      <View style={{ position: "absolute", left: 46, right: 46, bottom: 34, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <LogoMark color={t.brand} size={16} />
          <Text style={{ ...fonts.display(800), fontSize: 12, color: t.forest, marginLeft: 5 }}>
            Immo<Text style={{ color: t.brand }}>via</Text>
          </Text>
        </View>
        <Text style={{ fontSize: 8, color: t.muted }}>
          Verkaufsdokumentation · {formatDateLong(content.generatedAt)}
          {content.isPreview ? " · Vorschau" : ""}
        </Text>
      </View>
    </Page>
  );
}

function CoverPremium({ s, content, fonts }: { s: Styles; content: DossierContent; fonts: PdfFonts }) {
  const t = content.theme;
  return (
    <Page size="A4" style={[s.coverPage, { backgroundColor: t.text }]}>
      <View style={{ position: "relative", width: PAGE_WIDTH, height: PAGE_HEIGHT - 1 }}>
        {content.cover ? (
          // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image hat kein alt-Attribut
          <Image src={pdfSrc(content.cover)} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        ) : null}
        <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 300, backgroundColor: t.text, opacity: content.cover ? 0.82 : 1 }} />
        <View style={{ position: "absolute", left: 60, right: 60, bottom: 50 }}>
          <Text style={{ ...fonts.body(600), fontSize: 8, color: "#D8EBC6", letterSpacing: 2.4 }}>
            {`VERKAUFSDOKUMENTATION${content.isPreview ? " · VORSCHAU" : ""}`}
          </Text>
          <Text style={{ ...fonts.display(800), fontSize: 30, color: "#FFFFFF", lineHeight: 1.15, marginTop: 12, maxLines: 3, textOverflow: "ellipsis" }}>
            {content.title}
          </Text>
          <Text style={{ fontSize: 11, color: "#EAF3DF", marginTop: 10 }}>{content.locationLabel}</Text>
          <View style={{ flexDirection: "row", marginTop: 24, borderTopWidth: 0.5, borderTopColor: "#D8EBC6", paddingTop: 14 }}>
            <View style={{ marginRight: 34 }}>
              <Text style={{ fontSize: 7.5, color: "#D8EBC6", letterSpacing: 1.2 }}>{content.priceLabel.toUpperCase()}</Text>
              <Text style={{ ...fonts.display(800), fontSize: 15, color: "#FFFFFF", marginTop: 3 }}>{content.priceValue}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 7.5, color: "#D8EBC6", letterSpacing: 1.2 }}>OBJEKT</Text>
              <Text style={{ fontSize: 10.5, color: "#FFFFFF", marginTop: 4, lineHeight: LH }}>{content.subtitle}</Text>
            </View>
          </View>
        </View>
        <View style={{ position: "absolute", top: 40, left: 60, flexDirection: "row", alignItems: "center" }}>
          <LogoMark color="#FFFFFF" size={18} />
          <Text style={{ ...fonts.display(800), fontSize: 13, color: "#FFFFFF", marginLeft: 6 }}>Immovia</Text>
        </View>
        {content.cover?.isAiVisualization ? <Text style={[s.aiBadge, { top: 42, left: undefined, right: 60 }]}>KI-Visualisierung</Text> : null}
      </View>
    </Page>
  );
}

function CoverClassic({ s, content, fonts }: { s: Styles; content: DossierContent; fonts: PdfFonts }) {
  const t = content.theme;
  const facts = [{ label: content.priceLabel, value: content.priceValue }, ...content.keyFacts].slice(0, 8);
  return (
    <Page size="A4" style={s.coverPage}>
      <View style={{ backgroundColor: t.forest, paddingHorizontal: 50, paddingTop: 46, paddingBottom: 26 }}>
        <Text style={{ ...fonts.body(600), fontSize: 8, color: "#D8EBC6", letterSpacing: 1.6 }}>
          {`VERKAUFSDOKUMENTATION · ${OFFER_TYPES[content.offerType].verb.toUpperCase()}${content.isPreview ? " · VORSCHAU" : ""}`}
        </Text>
        <Text style={{ ...fonts.display(800), fontSize: 23, color: "#FFFFFF", lineHeight: 1.2, marginTop: 8, maxLines: 3, textOverflow: "ellipsis" }}>
          {content.title}
        </Text>
        <Text style={{ fontSize: 10.5, color: "#EAF3DF", marginTop: 6 }}>{content.locationLabel}</Text>
      </View>
      <View style={{ paddingHorizontal: 50, paddingTop: 24 }}>
        {content.cover ? (
          <View>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image hat kein alt-Attribut */}
            <Image src={pdfSrc(content.cover)} style={{ width: "100%", height: 320, objectFit: "cover" }} />
            {content.cover.isAiVisualization ? <Text style={s.aiBadge}>KI-Visualisierung</Text> : null}
          </View>
        ) : null}
        <View style={{ marginTop: 20 }}>
          {facts.map((fact, i) => (
            <View key={fact.label} style={[s.factRow, i % 2 === 0 ? s.factRowAlt : {}]}>
              <Text style={s.factLabel}>{fact.label}</Text>
              <Text style={s.factValue}>{fact.value}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={{ position: "absolute", left: 50, right: 50, bottom: 30, flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ ...fonts.display(800), fontSize: 11, color: t.forest }}>Immovia</Text>
        <Text style={{ fontSize: 8, color: t.muted }}>Erstellt am {formatDateLong(content.generatedAt)}</Text>
      </View>
    </Page>
  );
}

export function DossierDocument({ content }: { content: DossierContent }) {
  const fonts = ensurePdfFonts();
  const template = content.templateId;
  const s = buildStyles(content.theme, fonts, template);
  const on = content.sections;
  const descriptionParagraphs = paragraphs(content.description);
  const locationParagraphs = paragraphs(content.locationText);
  const equipmentParagraphs = paragraphs(content.equipmentText);
  const showIntro = Boolean(content.intro) || (on.highlights && content.highlights.length > 0);
  const showLocation = on.location && (locationParagraphs.length > 0 || content.locationFeatures.length > 0 || Boolean(content.viewDescription));
  const showEquipment = on.equipment && (equipmentParagraphs.length > 0 || content.equipmentItems.length > 0);
  const showGallery = on.gallery && content.gallery.length > 0;
  const showFloorPlans = on.floorPlans && content.floorPlans.length > 0;
  const hasAiImages = [content.cover, ...content.gallery].some((img) => img?.isAiVisualization);
  const contact = content.contact;
  const hasContact = on.contact && Boolean(contact.name || contact.company || contact.phone || contact.email);

  return (
    <Document title={content.title} author={contact.name ?? "Immovia"} subject="Verkaufsdokumentation" creator="Immovia" producer="Immovia" language="de-CH">
      {template === "premium" ? (
        <CoverPremium s={s} content={content} fonts={fonts} />
      ) : template === "classic" ? (
        <CoverClassic s={s} content={content} fonts={fonts} />
      ) : (
        <CoverModern s={s} content={content} fonts={fonts} />
      )}

      <Page size="A4" style={s.page} wrap>
        {template === "classic" ? (
          <View style={s.header} fixed>
            <Text style={s.headerText}>Verkaufsdokumentation</Text>
            <Text style={s.headerText}>Immovia</Text>
          </View>
        ) : null}
        <Footer s={s} content={content} />

        {showIntro ? (
          <>
            <SectionTitle s={s} template={template} eyebrow="Auf einen Blick" title="Das Wichtigste in Kürze" />
            {content.intro ? <Text style={s.lead}>{content.intro}</Text> : null}
            {on.highlights && content.highlights.length > 0 ? <Bullets s={s} items={content.highlights} columns={2} /> : null}
          </>
        ) : null}

        {on.keyFacts && content.keyFacts.length > 0 ? (
          <>
            <SectionTitle s={s} template={template} eyebrow="Eckdaten" title="Eckdaten" presence={90} />
            <KeyFacts s={s} facts={content.keyFacts} template={template} />
          </>
        ) : null}

        {on.description && descriptionParagraphs.length > 0 ? (
          <>
            <SectionTitle s={s} template={template} eyebrow="Objekt" title="Objektbeschreibung" />
            {descriptionParagraphs.map((p, i) => (
              <Text key={`d-${i}`} style={s.paragraph} orphans={2} widows={2}>
                {p}
              </Text>
            ))}
          </>
        ) : null}

        {showLocation ? (
          <>
            <SectionTitle s={s} template={template} eyebrow="Lage" title="Lage und Umgebung" />
            {locationParagraphs.map((p, i) => (
              <Text key={`l-${i}`} style={s.paragraph} orphans={2} widows={2}>
                {p}
              </Text>
            ))}
            {content.viewDescription ? <Text style={s.paragraph}>Aussicht: {content.viewDescription}</Text> : null}
            {content.locationFeatures.length > 0 ? <Bullets s={s} items={content.locationFeatures} columns={2} /> : null}
          </>
        ) : null}

        {showEquipment ? (
          <>
            <SectionTitle s={s} template={template} eyebrow="Ausstattung" title="Ausstattung" />
            {equipmentParagraphs.map((p, i) => (
              <Text key={`e-${i}`} style={s.paragraph} orphans={2} widows={2}>
                {p}
              </Text>
            ))}
            {content.equipmentItems.length > 0 ? <Bullets s={s} items={content.equipmentItems} columns={2} /> : null}
          </>
        ) : null}

        {on.renovations && content.renovations.length > 0 ? (
          <>
            <SectionTitle s={s} template={template} eyebrow="Unterhalt" title="Renovationen" />
            {content.renovations.map((r, i) => (
              <View key={`r-${i}`} style={[s.factRow, template === "classic" && i % 2 === 0 ? s.factRowAlt : {}]} wrap={false}>
                <Text style={[s.factLabel, { width: "18%" }]}>{r.year}</Text>
                <Text style={[s.text, { width: "82%" }]}>
                  <Text style={{ ...fonts.body(600) }}>{r.category}: </Text>
                  {r.description}
                </Text>
              </View>
            ))}
          </>
        ) : null}

        {showGallery ? (
          <>
            <SectionTitle s={s} template={template} eyebrow="Impressionen" title="Bildgalerie" breakBefore />
            {template === "premium"
              ? content.gallery.map((image, i) => (
                  <View key={`g-${i}`} style={{ marginBottom: 14 }} wrap={false}>
                    <GalleryImage s={s} image={image} style={s.premiumImage} />
                  </View>
                ))
              : chunk(content.gallery, 2).map((row, i) => (
                  <View key={`g-${i}`} style={s.galleryRow} wrap={false}>
                    <View style={s.galleryCellLeft}>
                      <GalleryImage s={s} image={row[0]!} style={s.galleryImage} />
                    </View>
                    <View style={s.galleryCell}>{row[1] ? <GalleryImage s={s} image={row[1]} style={s.galleryImage} /> : null}</View>
                  </View>
                ))}
          </>
        ) : null}

        {showFloorPlans ? (
          <>
            <SectionTitle s={s} template={template} eyebrow="Pläne" title="Grundrisse" breakBefore />
            {content.floorPlans.map((plan, i) => (
              <View key={`f-${i}`} style={s.floorPlanBlock} wrap={false}>
                {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image hat kein alt-Attribut */}
                <Image src={pdfSrc(plan)} style={s.floorPlan} />
                {plan.caption ? <Text style={s.caption}>{plan.caption}</Text> : null}
              </View>
            ))}
          </>
        ) : null}

        {on.documents && content.documents.length > 0 ? (
          <>
            <SectionTitle s={s} template={template} eyebrow="Unterlagen" title="Ergänzende Unterlagen" />
            <Text style={[s.small, { marginBottom: 6 }]}>Folgende Unterlagen stellt die Anbieterschaft auf Anfrage bzw. im Online-Inserat zur Verfügung:</Text>
            {content.documents.map((doc, i) => (
              <View key={`doc-${i}`} style={s.factRow} wrap={false}>
                <Text style={[s.factValue, { width: "62%" }]}>{doc.title}</Text>
                <Text style={[s.factLabel, { width: "38%", textAlign: "right" }]}>
                  {DOCUMENT_CATEGORIES[doc.category as DocumentCategory] ?? doc.category}
                </Text>
              </View>
            ))}
          </>
        ) : null}

        <SectionTitle s={s} template={template} eyebrow="Kontakt" title="Ansprechpartner" presence={190} />
        <View wrap={false}>
          <View style={s.contactCard}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              {hasContact ? (
                <>
                  {contact.name ? <Text style={s.contactName}>{contact.name}</Text> : null}
                  {contact.company ? <Text style={[s.text, { marginBottom: 6 }]}>{contact.company}</Text> : null}
                  {contact.phone ? <Text style={s.text}>Telefon: {formatPhone(contact.phone)}</Text> : null}
                  {contact.email ? <Text style={s.text}>E-Mail: {contact.email}</Text> : null}
                </>
              ) : (
                <Text style={s.text}>Kontaktaufnahme über das Inserat auf Immovia.</Text>
              )}
              {content.listingUrl ? <Text style={[s.small, { marginTop: 10 }]}>Online-Inserat: {content.listingUrl}</Text> : null}
            </View>
            {on.qrCode && content.qrCode ? (
              <View style={{ alignItems: "center" }}>
                {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image hat kein alt-Attribut */}
                <Image src={{ data: content.qrCode, format: "png" }} style={s.qr} />
                <Text style={[s.small, { marginTop: 4 }]}>Zum Inserat</Text>
              </View>
            ) : null}
          </View>
          <Text style={s.disclaimer}>
            Alle Angaben stammen von der Anbieterschaft und erfolgen ohne Gewähr. Massgebend sind die Vertragsunterlagen.
            {hasAiImages
              ? " Mit «KI-Visualisierung» gekennzeichnete Bilder wurden mit künstlicher Intelligenz verändert und zeigen nicht den tatsächlichen Zustand."
              : ""}{" "}
            Erstellt mit Immovia am {formatDateLong(content.generatedAt)}.
          </Text>
        </View>
      </Page>
    </Document>
  );
}
