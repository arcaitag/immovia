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
 */

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;

function buildStyles(theme: PdfTheme, fonts: PdfFonts, template: DossierTemplateId) {
  const marginX = template === "premium" ? 60 : 50;
  return StyleSheet.create({
    page: {
      ...fonts.body(400),
      backgroundColor: theme.background,
      color: theme.text,
      fontSize: 10,
      lineHeight: 1.55,
      paddingTop: template === "classic" ? 76 : 56,
      paddingBottom: 72,
      paddingHorizontal: marginX,
    },
    coverPage: { ...fonts.body(400), backgroundColor: theme.background, color: theme.text, padding: 0 },
    // Kopf- und Fusszeile
    header: {
      position: "absolute",
      top: 30,
      left: marginX,
      right: marginX,
      flexDirection: "row",
      justifyContent: "space-between",
      borderBottomWidth: 1,
      borderBottomColor: theme.heading,
      paddingBottom: 6,
    },
    headerText: { ...fonts.body(600), fontSize: 8, color: theme.heading },
    footer: {
      position: "absolute",
      bottom: 30,
      left: marginX,
      right: marginX,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderTopWidth: 0.5,
      borderTopColor: theme.border,
      paddingTop: 8,
    },
    footerText: { fontSize: 7.5, color: theme.muted, maxWidth: 260 },
    previewMark: { ...fonts.body(700), fontSize: 7.5, color: theme.accent, textTransform: "uppercase", letterSpacing: 1 },
    // Abschnitte
    section: { marginBottom: template === "premium" ? 30 : 24 },
    sectionHead: { marginBottom: 12 },
    sectionBar: { width: 26, height: 3, borderRadius: 2, backgroundColor: theme.accent, marginBottom: 7 },
    sectionEyebrow: { ...fonts.body(600), fontSize: 7.5, color: theme.accent, textTransform: "uppercase", letterSpacing: 1.6, marginBottom: 4 },
    sectionTitle: {
      ...fonts.display(800),
      fontSize: template === "premium" ? 19 : template === "classic" ? 13.5 : 16,
      color: theme.heading,
      lineHeight: 1.25,
    },
    classicTitleWrap: { borderBottomWidth: 1, borderBottomColor: theme.heading, paddingBottom: 5 },
    paragraph: { marginBottom: 8, textAlign: "left" },
    lead: { fontSize: 11.5, lineHeight: 1.6, color: theme.text, marginBottom: 14 },
    muted: { color: theme.muted },
    small: { fontSize: 8.5, color: theme.muted },
    // Listen
    bulletRow: { flexDirection: "row", marginBottom: 5, paddingRight: 8 },
    bulletDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: theme.accent, marginTop: 5, marginRight: 8 },
    twoCols: { flexDirection: "row", flexWrap: "wrap" },
    halfCol: { width: "50%" },
    // Eckdaten
    tiles: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4 },
    tileWrap: { width: "33.33%", padding: 4 },
    tile: { backgroundColor: theme.surface, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 11, minHeight: 46 },
    tileLabel: { ...fonts.body(600), fontSize: 7, color: theme.muted, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 2 },
    tileValue: { ...fonts.body(700), fontSize: 10.5, color: theme.heading },
    factRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: theme.border, paddingVertical: 6 },
    factRowAlt: { backgroundColor: "#F8FAF6" },
    factLabel: { width: "42%", color: theme.muted, paddingLeft: template === "classic" ? 6 : 0 },
    factValue: { ...fonts.body(600), width: "58%", color: theme.text },
    // Bilder
    galleryRow: { flexDirection: "row", marginBottom: 10 },
    galleryCell: { flex: 1 },
    galleryCellLeft: { flex: 1, marginRight: 10 },
    galleryImage: { width: "100%", height: template === "classic" ? 165 : 175, objectFit: "cover", borderRadius: template === "classic" ? 0 : 8 },
    premiumImage: { width: "100%", height: 300, objectFit: "cover" },
    caption: { fontSize: 7.5, color: theme.muted, marginTop: 4 },
    aiBadge: {
      position: "absolute",
      top: 8,
      left: 8,
      backgroundColor: theme.text,
      color: "#FFFFFF",
      fontSize: 7,
      paddingVertical: 2,
      paddingHorizontal: 6,
      borderRadius: 4,
      ...fonts.body(700),
    },
    floorPlan: { width: "100%", height: 470, objectFit: "contain" },
    // Kontakt
    contactCard: {
      flexDirection: "row",
      backgroundColor: theme.surface,
      borderRadius: template === "classic" ? 0 : 12,
      borderWidth: template === "classic" ? 1 : 0,
      borderColor: theme.border,
      padding: 18,
    },
    contactName: { ...fonts.display(800), fontSize: 14, color: theme.heading, marginBottom: 4 },
    qr: { width: 92, height: 92 },
    disclaimer: { fontSize: 7.5, color: theme.muted, marginTop: 18, lineHeight: 1.5 },
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

function SectionTitle({ s, eyebrow, title, template }: { s: Styles; eyebrow?: string; title: string; template: DossierTemplateId }) {
  return (
    <View style={s.sectionHead} minPresenceAhead={70}>
      {template === "modern" ? <View style={s.sectionBar} /> : null}
      {template === "premium" && eyebrow ? <Text style={s.sectionEyebrow}>{eyebrow}</Text> : null}
      <View style={template === "classic" ? s.classicTitleWrap : {}}>
        <Text style={s.sectionTitle}>{title}</Text>
      </View>
    </View>
  );
}

function Bullets({ s, items, columns = 1 }: { s: Styles; items: string[]; columns?: 1 | 2 }) {
  return (
    <View style={columns === 2 ? s.twoCols : {}}>
      {items.map((item, i) => (
        <View key={`${item}-${i}`} style={[s.bulletRow, columns === 2 ? s.halfCol : {}]} wrap={false}>
          <View style={s.bulletDot} />
          <Text style={{ flex: 1 }}>{item}</Text>
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
              <Text style={s.tileLabel}>{fact.label}</Text>
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

function GalleryImage({ s, image, style }: { s: Styles; image: PdfImage; style: Styles[keyof Styles] }) {
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
      <Text style={s.footerText}>{content.title}</Text>
      {content.isPreview ? <Text style={s.previewMark}>Vorschau</Text> : null}
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
      <View style={{ paddingHorizontal: 46, paddingTop: 30 }}>
        <Text style={{ ...fonts.body(700), fontSize: 8.5, color: t.accent, textTransform: "uppercase", letterSpacing: 1.6 }}>
          {OFFER_TYPES[content.offerType].verb}
        </Text>
        <Text style={{ ...fonts.display(800), fontSize: 27, color: t.heading, lineHeight: 1.18, marginTop: 6 }}>{content.title}</Text>
        <Text style={{ fontSize: 11.5, color: t.muted, marginTop: 8 }}>{content.locationLabel}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 20 }}>
          <View style={{ backgroundColor: t.mint, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 14, marginRight: 16 }}>
            <Text style={{ fontSize: 7.5, color: t.forest, textTransform: "uppercase", letterSpacing: 0.8 }}>{content.priceLabel}</Text>
            <Text style={{ ...fonts.display(800), fontSize: 16, color: t.forest }}>{content.priceValue}</Text>
          </View>
          <Text style={{ fontSize: 10.5, color: t.text, flex: 1 }}>{content.subtitle}</Text>
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
      {content.cover ? (
        // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image hat kein alt-Attribut
        <Image src={pdfSrc(content.cover)} style={{ position: "absolute", top: 0, left: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, objectFit: "cover" }} />
      ) : null}
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 290, backgroundColor: t.text, opacity: content.cover ? 0.84 : 1 }} />
      <View style={{ position: "absolute", left: 60, right: 60, bottom: 52, height: 238 }}>
        <Text style={{ ...fonts.body(600), fontSize: 8, color: "#D8EBC6", textTransform: "uppercase", letterSpacing: 2.4 }}>
          Verkaufsdokumentation{content.isPreview ? " · Vorschau" : ""}
        </Text>
        <Text style={{ ...fonts.display(800), fontSize: 30, color: "#FFFFFF", lineHeight: 1.15, marginTop: 12 }}>{content.title}</Text>
        <Text style={{ fontSize: 11, color: "#EAF3DF", marginTop: 10 }}>{content.locationLabel}</Text>
        <View style={{ flexDirection: "row", marginTop: 26, borderTopWidth: 0.5, borderTopColor: "#D8EBC6", paddingTop: 14 }}>
          <View style={{ marginRight: 34 }}>
            <Text style={{ fontSize: 7.5, color: "#D8EBC6", textTransform: "uppercase", letterSpacing: 1.2 }}>{content.priceLabel}</Text>
            <Text style={{ ...fonts.display(800), fontSize: 15, color: "#FFFFFF", marginTop: 3 }}>{content.priceValue}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 7.5, color: "#D8EBC6", textTransform: "uppercase", letterSpacing: 1.2 }}>Objekt</Text>
            <Text style={{ fontSize: 10.5, color: "#FFFFFF", marginTop: 4 }}>{content.subtitle}</Text>
          </View>
        </View>
      </View>
      <View style={{ position: "absolute", top: 40, left: 60, flexDirection: "row", alignItems: "center" }}>
        <LogoMark color="#FFFFFF" size={18} />
        <Text style={{ ...fonts.display(800), fontSize: 13, color: "#FFFFFF", marginLeft: 6 }}>Immovia</Text>
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
        <Text style={{ ...fonts.body(600), fontSize: 8, color: "#D8EBC6", textTransform: "uppercase", letterSpacing: 1.6 }}>
          Verkaufsdokumentation · {OFFER_TYPES[content.offerType].verb}
          {content.isPreview ? " · Vorschau" : ""}
        </Text>
        <Text style={{ ...fonts.display(800), fontSize: 23, color: "#FFFFFF", lineHeight: 1.2, marginTop: 8 }}>{content.title}</Text>
        <Text style={{ fontSize: 10.5, color: "#EAF3DF", marginTop: 6 }}>{content.locationLabel}</Text>
      </View>
      <View style={{ paddingHorizontal: 50, paddingTop: 24 }}>
        {content.cover ? (
          // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image hat kein alt-Attribut
          <Image src={pdfSrc(content.cover)} style={{ width: "100%", height: 320, objectFit: "cover" }} />
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
  const showLocation = on.location && (locationParagraphs.length > 0 || content.locationFeatures.length > 0 || Boolean(content.viewDescription));
  const showEquipment = on.equipment && (equipmentParagraphs.length > 0 || content.equipmentItems.length > 0);
  const showGallery = on.gallery && content.gallery.length > 0;
  const showFloorPlans = on.floorPlans && content.floorPlans.length > 0;
  const hasAiImages = [content.cover, ...content.gallery].some((img) => img?.isAiVisualization);
  const contact = content.contact;
  const hasContact = Boolean(contact.name || contact.company || contact.phone || contact.email);

  return (
    <Document
      title={content.title}
      author={contact.name ?? "Immovia"}
      subject="Verkaufsdokumentation"
      creator="Immovia"
      producer="Immovia"
      language="de-CH"
    >
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
            <Text style={s.headerText}>{content.title}</Text>
            <Text style={s.headerText}>Verkaufsdokumentation</Text>
          </View>
        ) : null}
        <Footer s={s} content={content} />

        {content.intro || (on.highlights && content.highlights.length > 0) ? (
          <View style={s.section}>
            <SectionTitle s={s} template={template} eyebrow="Auf einen Blick" title="Das Wichtigste in Kürze" />
            {content.intro ? <Text style={s.lead}>{content.intro}</Text> : null}
            {on.highlights && content.highlights.length > 0 ? <Bullets s={s} items={content.highlights} columns={2} /> : null}
          </View>
        ) : null}

        {on.keyFacts && content.keyFacts.length > 0 ? (
          <View style={s.section}>
            <SectionTitle s={s} template={template} eyebrow="Eckdaten" title="Eckdaten" />
            <KeyFacts s={s} facts={content.keyFacts} template={template} />
          </View>
        ) : null}

        {on.description && descriptionParagraphs.length > 0 ? (
          <View style={s.section}>
            <SectionTitle s={s} template={template} eyebrow="Objekt" title="Objektbeschreibung" />
            {descriptionParagraphs.map((p, i) => (
              <Text key={i} style={s.paragraph} orphans={2} widows={2}>
                {p}
              </Text>
            ))}
          </View>
        ) : null}

        {showLocation ? (
          <View style={s.section}>
            <SectionTitle s={s} template={template} eyebrow="Lage" title="Lage und Umgebung" />
            {locationParagraphs.map((p, i) => (
              <Text key={i} style={s.paragraph} orphans={2} widows={2}>
                {p}
              </Text>
            ))}
            {content.viewDescription ? <Text style={s.paragraph}>Aussicht: {content.viewDescription}</Text> : null}
            {content.locationFeatures.length > 0 ? <Bullets s={s} items={content.locationFeatures} columns={2} /> : null}
          </View>
        ) : null}

        {showEquipment ? (
          <View style={s.section}>
            <SectionTitle s={s} template={template} eyebrow="Ausstattung" title="Ausstattung" />
            {equipmentParagraphs.map((p, i) => (
              <Text key={i} style={s.paragraph} orphans={2} widows={2}>
                {p}
              </Text>
            ))}
            {content.equipmentItems.length > 0 ? <Bullets s={s} items={content.equipmentItems} columns={2} /> : null}
          </View>
        ) : null}

        {on.renovations && content.renovations.length > 0 ? (
          <View style={s.section}>
            <SectionTitle s={s} template={template} eyebrow="Unterhalt" title="Renovationen" />
            {content.renovations.map((r, i) => (
              <View key={`${r.year}-${i}`} style={[s.factRow, template === "classic" && i % 2 === 0 ? s.factRowAlt : {}]} wrap={false}>
                <Text style={[s.factLabel, { width: "20%" }]}>{r.year}</Text>
                <Text style={{ width: "80%" }}>
                  <Text style={{ ...fonts.body(600) }}>{r.category}: </Text>
                  {r.description}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {showGallery ? (
          <View style={s.section} break>
            <SectionTitle s={s} template={template} eyebrow="Impressionen" title="Bildgalerie" />
            {template === "premium"
              ? content.gallery.map((image, i) => (
                  <View key={i} style={{ marginBottom: 14 }} wrap={false}>
                    <GalleryImage s={s} image={image} style={s.premiumImage} />
                  </View>
                ))
              : chunk(content.gallery, 2).map((row, i) => (
                  <View key={i} style={s.galleryRow} wrap={false}>
                    {row.map((image, j) => (
                      <View key={j} style={j === 0 && row.length > 1 ? s.galleryCellLeft : s.galleryCell}>
                        <GalleryImage s={s} image={image} style={s.galleryImage} />
                      </View>
                    ))}
                    {row.length === 1 ? <View style={s.galleryCell} /> : null}
                  </View>
                ))}
          </View>
        ) : null}

        {showFloorPlans ? (
          <View style={s.section} break>
            <SectionTitle s={s} template={template} eyebrow="Pläne" title="Grundrisse" />
            {content.floorPlans.map((plan, i) => (
              <View key={i} style={{ marginBottom: 18 }} wrap={false}>
                {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image hat kein alt-Attribut */}
                <Image src={pdfSrc(plan)} style={s.floorPlan} />
                {plan.caption ? <Text style={s.caption}>{plan.caption}</Text> : null}
              </View>
            ))}
          </View>
        ) : null}

        {on.documents && content.documents.length > 0 ? (
          <View style={s.section}>
            <SectionTitle s={s} template={template} eyebrow="Unterlagen" title="Ergänzende Unterlagen" />
            <Text style={[s.small, { marginBottom: 8 }]}>Folgende Unterlagen stellt die Anbieterschaft auf Anfrage bzw. im Online-Inserat zur Verfügung:</Text>
            {content.documents.map((doc, i) => (
              <View key={`${doc.title}-${i}`} style={s.factRow} wrap={false}>
                <Text style={[s.factValue, { width: "62%" }]}>{doc.title}</Text>
                <Text style={[s.factLabel, { width: "38%", textAlign: "right" }]}>
                  {DOCUMENT_CATEGORIES[doc.category as DocumentCategory] ?? doc.category}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={s.section} wrap={false}>
          <SectionTitle s={s} template={template} eyebrow="Kontakt" title="Ansprechpartner" />
          <View style={s.contactCard}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              {on.contact && hasContact ? (
                <>
                  {contact.name ? <Text style={s.contactName}>{contact.name}</Text> : null}
                  {contact.company ? <Text style={{ marginBottom: 6 }}>{contact.company}</Text> : null}
                  {contact.phone ? <Text>Telefon: {formatPhone(contact.phone)}</Text> : null}
                  {contact.email ? <Text>E-Mail: {contact.email}</Text> : null}
                </>
              ) : (
                <Text>Kontaktaufnahme über das Inserat auf Immovia.</Text>
              )}
              {content.listingUrl ? (
                <Text style={[s.small, { marginTop: 10 }]}>Online-Inserat: {content.listingUrl}</Text>
              ) : null}
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
            {hasAiImages ? " Mit «KI-Visualisierung» gekennzeichnete Bilder wurden mit künstlicher Intelligenz verändert und zeigen nicht den tatsächlichen Zustand." : ""}{" "}
            Erstellt mit Immovia am {formatDateLong(content.generatedAt)}.
          </Text>
        </View>
      </Page>
    </Document>
  );
}
