import * as React from "react";
import { Document, Page, Path, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import { formatArea, formatChf, formatDate, formatDateLong, formatRooms } from "@/lib/format";
import { ensurePdfFonts } from "@/lib/pdf/fonts";
import { DEFAULT_TEMPLATE_THEMES } from "@/lib/pdf/theme";
import type { ValuationFactor } from "@/lib/valuation/types";

/** Bewertungsbericht als PDF (Export auf Abruf). */

export interface ValuationReportContent {
  propertyTitle: string;
  locationLabel: string;
  rent: boolean;
  createdAt: string;
  statusLabel: string;
  hasNumbers: boolean;
  estimatedValue: number | null;
  valueLow: number | null;
  valueHigh: number | null;
  suggestedListPrice: number | null;
  listPriceExplanation: string | null;
  confidenceLabel: string;
  confidenceExplanation: string | null;
  summary: string | null;
  explanation: string | null;
  quality: { label: string; value: string }[];
  notes: string[];
  missing: string[];
  suggestions: string[];
  sources: Array<{ name: string; typeLabel: string; description: string | null; dataAsOf: string | null; recordCount: number | null; licenseNote: string | null }>;
  comparables: Array<{
    location: string;
    typeLabel: string;
    rooms: number | null;
    area: number | null;
    price: number;
    pricePerSqm: number | null;
    observedAt: string;
    distanceKm: number | null;
  }>;
  areaLabel: string;
  positive: ValuationFactor[];
  negative: ValuationFactor[];
  disclaimer: string;
}

const t = DEFAULT_TEMPLATE_THEMES.modern;

export function ValuationReportDocument({ content }: { content: ValuationReportContent }) {
  const fonts = ensurePdfFonts();
  const s = StyleSheet.create({
    page: { ...fonts.body(400), fontSize: 9.5, lineHeight: 1.5, color: t.text, paddingTop: 48, paddingBottom: 64, paddingHorizontal: 46 },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 22 },
    brand: { ...fonts.display(800), fontSize: 13, color: t.forest, marginLeft: 6 },
    eyebrow: { ...fonts.body(700), fontSize: 8, color: t.accent, textTransform: "uppercase", letterSpacing: 1.4 },
    title: { ...fonts.display(800), fontSize: 20, color: t.heading, marginTop: 4, lineHeight: 1.2 },
    subtitle: { color: t.muted, marginTop: 3 },
    card: { backgroundColor: t.surface, borderRadius: 12, padding: 18, marginTop: 18 },
    big: { ...fonts.display(800), fontSize: 26, color: t.forest },
    label: { ...fonts.body(600), fontSize: 7.5, color: t.muted, textTransform: "uppercase", letterSpacing: 0.7 },
    value: { ...fonts.body(700), fontSize: 11, color: t.heading },
    section: { marginTop: 20 },
    h2: { ...fonts.display(800), fontSize: 13, color: t.heading, marginBottom: 7 },
    p: { marginBottom: 6 },
    small: { fontSize: 8, color: t.muted },
    row: { flexDirection: "row" },
    th: { ...fonts.body(700), fontSize: 7.5, color: t.muted, paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: t.border },
    td: { fontSize: 8.5, paddingVertical: 4.5, borderBottomWidth: 0.5, borderBottomColor: t.border },
    notice: { backgroundColor: "#FEF6E7", borderRadius: 10, padding: 14, marginTop: 18 },
    footer: { position: "absolute", bottom: 28, left: 46, right: 46, flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: t.muted },
  });

  const low = content.valueLow ?? 0;
  const high = content.valueHigh ?? 0;
  const est = content.estimatedValue ?? 0;
  const span = high - low;
  const markerPct = span > 0 ? Math.min(100, Math.max(0, ((est - low) / span) * 100)) : 50;
  const per = content.rent ? " / Monat" : "";
  const cols = [
    { label: "Ort", width: "22%" },
    { label: "Objektart", width: "15%" },
    { label: "Zimmer", width: "8%" },
    { label: content.areaLabel, width: "11%" },
    { label: "Angebotspreis", width: "14%" },
    { label: "CHF/m²", width: "10%" },
    { label: "Inseriert", width: "11%" },
    { label: "Distanz", width: "9%" },
  ];

  return (
    <Document title={`Bewertungsbericht – ${content.propertyTitle}`} author="Immovia" creator="Immovia" producer="Immovia" language="de-CH">
      <Page size="A4" style={s.page} wrap>
        <View style={s.header}>
          <View style={s.row}>
            <Svg width={18} height={18} viewBox="0 0 40 40">
              <Path d="M6.5 18.2 20 6.5l13.5 11.7V31a2.5 2.5 0 0 1-2.5 2.5H9A2.5 2.5 0 0 1 6.5 31V18.2Z" stroke={t.brand} strokeWidth={3.2} fill="none" />
              <Path d="M15.5 33.5v-8.2a4.5 4.5 0 0 1 9 0v8.2" stroke={t.brand} strokeWidth={3.2} fill="none" />
            </Svg>
            <Text style={s.brand}>Immovia</Text>
          </View>
          <Text style={s.small}>Bewertungsbericht vom {formatDateLong(content.createdAt)}</Text>
        </View>

        <Text style={s.eyebrow}>{content.statusLabel}</Text>
        <Text style={s.title}>{content.propertyTitle}</Text>
        <Text style={s.subtitle}>{content.locationLabel}</Text>

        {content.hasNumbers ? (
          <View style={s.card} wrap={false}>
            <Text style={s.label}>Geschätzter Marktwert (auf Basis von Angebotspreisen)</Text>
            <Text style={s.big}>
              {formatChf(content.estimatedValue)}
              {per}
            </Text>
            <View style={{ marginTop: 14 }}>
              <View style={{ height: 8, backgroundColor: "#D8EBC6", borderRadius: 4 }}>
                <View style={{ position: "absolute", left: `${markerPct}%`, top: -4, width: 3, height: 16, marginLeft: -1.5, backgroundColor: t.forest, borderRadius: 1.5 }} />
              </View>
              <View style={[s.row, { justifyContent: "space-between", marginTop: 6 }]}>
                <Text style={s.small}>{formatChf(content.valueLow)}</Text>
                <Text style={s.small}>Spanne (25.–75. Perzentil)</Text>
                <Text style={s.small}>{formatChf(content.valueHigh)}</Text>
              </View>
            </View>
            <View style={[s.row, { marginTop: 14 }]}>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Möglicher Inseratepreis</Text>
                <Text style={s.value}>
                  {formatChf(content.suggestedListPrice)}
                  {per}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Vertrauensgrad</Text>
                <Text style={s.value}>{content.confidenceLabel}</Text>
              </View>
            </View>
            {content.listPriceExplanation ? <Text style={[s.small, { marginTop: 10 }]}>{content.listPriceExplanation}</Text> : null}
          </View>
        ) : (
          <View style={s.notice} wrap={false}>
            <Text style={[s.value, { color: "#9A4B06" }]}>Noch keine belastbare Bewertung möglich</Text>
            {content.missing.map((m, i) => (
              <Text key={i} style={{ marginTop: 4 }}>
                {m}
              </Text>
            ))}
            {content.suggestions.length ? (
              <View style={{ marginTop: 8 }}>
                <Text style={s.label}>Was helfen würde</Text>
                {content.suggestions.map((m, i) => (
                  <Text key={i} style={{ marginTop: 3 }}>
                    – {m}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
        )}

        {content.confidenceExplanation || content.summary ? (
          <View style={s.section}>
            <Text style={s.h2} minPresenceAhead={40}>
              Berechnung und Vertrauensgrad
            </Text>
            {content.summary ? <Text style={s.p}>{content.summary}</Text> : null}
            {content.confidenceExplanation ? <Text style={s.p}>{content.confidenceExplanation}</Text> : null}
            {content.notes.map((n, i) => (
              <Text key={i} style={[s.p, s.small]}>
                Hinweis: {n}
              </Text>
            ))}
          </View>
        ) : null}

        {content.explanation ? (
          <View style={s.section}>
            <Text style={s.h2} minPresenceAhead={40}>
              Erklärung (KI-generiert)
            </Text>
            <Text style={s.p}>{content.explanation}</Text>
            <Text style={s.small}>Die Erklärung wurde von einer KI ausschliesslich auf Basis der oben berechneten Daten formuliert.</Text>
          </View>
        ) : null}

        {content.quality.length ? (
          <View style={s.section} wrap={false}>
            <Text style={s.h2}>Datenqualität</Text>
            {content.quality.map((q) => (
              <View key={q.label} style={[s.row, { borderBottomWidth: 0.5, borderBottomColor: t.border, paddingVertical: 4 }]}>
                <Text style={{ width: "45%", color: t.muted }}>{q.label}</Text>
                <Text style={{ width: "55%" }}>{q.value}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={s.section}>
          <Text style={s.h2} minPresenceAhead={40}>
            Datenquellen
          </Text>
          {content.sources.length === 0 ? <Text style={s.small}>Keine Datenquellen verwendet.</Text> : null}
          {content.sources.map((src, i) => (
            <View key={i} style={{ marginBottom: 8 }} wrap={false}>
              <Text style={s.value}>
                {src.name} <Text style={s.small}>({src.typeLabel})</Text>
              </Text>
              {src.description ? <Text>{src.description}</Text> : null}
              <Text style={s.small}>
                {src.dataAsOf ? `Stand ${formatDate(src.dataAsOf)}` : ""}
                {src.recordCount !== null ? ` · ${src.recordCount} Datensätze` : ""}
                {src.licenseNote ? ` · ${src.licenseNote}` : ""}
              </Text>
            </View>
          ))}
        </View>

        {content.comparables.length ? (
          <View style={s.section}>
            <Text style={s.h2} minPresenceAhead={60}>
              Vergleichsobjekte
            </Text>
            <Text style={[s.small, { marginBottom: 6 }]}>Angebotspreise veröffentlichter Inserate auf Immovia – keine Transaktionspreise.</Text>
            <View style={s.row} fixed={false}>
              {cols.map((c) => (
                <Text key={c.label} style={[s.th, { width: c.width }]}>
                  {c.label}
                </Text>
              ))}
            </View>
            {content.comparables.map((c, i) => (
              <View key={i} style={s.row} wrap={false}>
                <Text style={[s.td, { width: cols[0]!.width }]}>{c.location}</Text>
                <Text style={[s.td, { width: cols[1]!.width }]}>{c.typeLabel}</Text>
                <Text style={[s.td, { width: cols[2]!.width }]}>{c.rooms !== null ? formatRooms(c.rooms, false) : "–"}</Text>
                <Text style={[s.td, { width: cols[3]!.width }]}>{c.area !== null ? formatArea(c.area) : "–"}</Text>
                <Text style={[s.td, { width: cols[4]!.width }]}>{formatChf(c.price)}</Text>
                <Text style={[s.td, { width: cols[5]!.width }]}>{c.pricePerSqm !== null ? formatChf(Math.round(c.pricePerSqm)) : "–"}</Text>
                <Text style={[s.td, { width: cols[6]!.width }]}>{formatDate(c.observedAt)}</Text>
                <Text style={[s.td, { width: cols[7]!.width }]}>{c.distanceKm !== null ? `${c.distanceKm.toFixed(1)} km` : "–"}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {content.positive.length || content.negative.length ? (
          <View style={s.section}>
            <Text style={s.h2} minPresenceAhead={50}>
              Qualitative Wertfaktoren
            </Text>
            <Text style={[s.small, { marginBottom: 8 }]}>Aus den erfassten Objektdaten abgeleitet. Sie sind nicht rechnerisch in der Schätzung enthalten.</Text>
            <View style={s.row}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={[s.label, { color: t.accent, marginBottom: 4 }]}>Können den Wert erhöhen</Text>
                {content.positive.length === 0 ? <Text style={s.small}>Keine erfasst.</Text> : null}
                {content.positive.map((f) => (
                  <Text key={f.key} style={{ marginBottom: 4 }}>
                    + {f.label}: <Text style={s.small}>{f.detail}</Text>
                  </Text>
                ))}
              </View>
              <View style={{ flex: 1, paddingLeft: 10 }}>
                <Text style={[s.label, { color: "#9A4B06", marginBottom: 4 }]}>Können den Wert reduzieren</Text>
                {content.negative.length === 0 ? <Text style={s.small}>Keine erfasst.</Text> : null}
                {content.negative.map((f) => (
                  <Text key={f.key} style={{ marginBottom: 4 }}>
                    − {f.label}: <Text style={s.small}>{f.detail}</Text>
                  </Text>
                ))}
              </View>
            </View>
          </View>
        ) : null}

        <View style={s.section} wrap={false}>
          <Text style={s.h2}>Haftungsausschluss</Text>
          <Text style={s.small}>{content.disclaimer}</Text>
        </View>

        <View style={s.footer} fixed>
          <Text>Immovia · Bewertungsbericht · {content.propertyTitle}</Text>
          <Text render={({ pageNumber, totalPages }) => `Seite ${pageNumber} von ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
