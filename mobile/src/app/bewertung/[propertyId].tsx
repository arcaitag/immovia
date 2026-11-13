import { Ionicons } from "@expo/vector-icons";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { AvailabilityNotice, BulletList, Card, Disclosure, JobProgressRow, QuotaHint, toolErrorMessage, toolStyles, useTextAiConsent } from "@/components/tools";
import { Badge, Button, EmptyState, Loading, Notice, SectionTitle } from "@/components/ui";
import { formatDate, formatDateTimeFull, startValuation, valuationState, type Tone, type ValuationDetail, type ValuationState } from "@/lib/api-tools";
import { useAuth } from "@/lib/auth";
import { CONFIG } from "@/lib/config";
import { formatNumber } from "@/lib/format";
import { ApiError, useJob } from "@/lib/jobs";
import { colors, radius, space, text } from "@/lib/theme";

const BADGE_TONE: Record<Tone, "neutral" | "green" | "amber" | "blue" | "dark"> = {
  neutral: "neutral",
  green: "green",
  blue: "blue",
  amber: "amber",
  red: "amber",
  dark: "dark",
};

const chf = (value: number | null) => (value === null ? "–" : `CHF ${formatNumber(value)}`);

export default function ValuationScreen() {
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();
  const { userId } = useAuth();
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const query = useQuery({
    queryKey: ["valuation", propertyId, selectedId],
    queryFn: () => valuationState(propertyId, selectedId),
    enabled: Boolean(userId),
    placeholderData: keepPreviousData,
  });

  let body: React.ReactNode;
  if (!userId) body = <EmptyState icon="lock-closed-outline" title="Bitte anmelden" description="Melden Sie sich an, um Ihre Immobilie zu bewerten." />;
  else if (query.isPending) body = <Loading />;
  else if (query.isError) {
    body =
      query.error instanceof ApiError && query.error.status === 404 ? (
        <EmptyState icon="home-outline" title="Nicht gefunden" description="Diese Immobilie gibt es nicht mehr oder sie gehört zu einem anderen Konto." />
      ) : (
        <View style={{ padding: space.lg, gap: space.md }}>
          <Notice tone="error">{toolErrorMessage(query.error)}</Notice>
          <Button title="Erneut versuchen" variant="outline" onPress={() => query.refetch()} />
        </View>
      );
  } else {
    body = <Valuation propertyId={propertyId} state={query.data} onSelect={setSelectedId} switching={query.isPlaceholderData} />;
  }
  return (
    <>
      <Stack.Screen options={{ title: "Bewertung" }} />
      {body}
    </>
  );
}

function Valuation({
  propertyId,
  state,
  onSelect,
  switching,
}: {
  propertyId: string;
  state: ValuationState;
  onSelect: (id: string | null) => void;
  switching: boolean;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const consent = useTextAiConsent(state.explanation === "needs_consent");
  const [jobId, setJobId] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<{ tone: "success" | "error" | "info"; text: string } | null>(null);
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["valuation", propertyId] });
    queryClient.invalidateQueries({ queryKey: ["workspace", propertyId] });
  };

  const { job, running, error: jobError } = useJob(jobId, {
    onSuccess: (finished) => {
      const result = finished.result as { valuationId?: string; status?: string } | null;
      setMessage(
        result?.status === "insufficient_data"
          ? { tone: "info", text: "Bewertung abgeschlossen – zu wenige Vergleichsdaten." }
          : { tone: "success", text: "Die Bewertung ist fertig." },
      );
      setJobId(null);
      // Neueste Bewertung anzeigen
      onSelect(null);
      refresh();
    },
    onError: (failed) => {
      setMessage({ tone: "error", text: failed.error ?? "Die Bewertung ist fehlgeschlagen." });
      setJobId(null);
      refresh();
    },
  });

  const start = useMutation({
    mutationFn: () => startValuation(propertyId),
    onMutate: () => setMessage(null),
    onSuccess: (res) => setJobId(res.jobId),
    onError: (error) => setMessage({ tone: "error", text: toolErrorMessage(error) }),
  });

  const hasValuation = state.history.length > 0;
  const blocked = !state.prerequisites.ready || !state.availability.available;
  const suffix = state.rent ? " / Mt." : "";

  return (
    <ScrollView contentContainerStyle={toolStyles.screen}>
      <View style={{ gap: space.xs }}>
        <Text style={text.title}>Immobilienbewertung</Text>
        <Text style={[text.body, { color: colors.muted }]}>
          Eine erste Orientierung zum Wert Ihrer Immobilie – nachvollziehbar berechnet und ehrlich gekennzeichnet. Frühere Bewertungen bleiben gespeichert.
        </Text>
      </View>

      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}

      <Card>
        <SectionTitle>{hasValuation ? "Neue Bewertung durchführen" : "Bewertung starten"}</SectionTitle>
        <Text style={text.small}>
          Die Schätzung vergleicht Ihr Objekt mit Angebotspreisen veröffentlichter Inserate auf Immovia. Ohne ausreichende Vergleichsdaten wird keine Zahl
          angezeigt.
        </Text>
        <View style={{ gap: space.sm }} accessibilityLabel="Voraussetzungen">
          {state.prerequisites.items.map((item) => (
            <View key={item.key} style={[toolStyles.box, { flexDirection: "row", gap: space.sm }, item.ok && { backgroundColor: colors.mint100, borderColor: colors.mint200 }]}>
              <Ionicons
                name={item.ok ? "checkmark-circle" : item.blocking ? "ellipse-outline" : "warning-outline"}
                size={18}
                color={item.ok ? colors.brand : item.blocking ? colors.muted : colors.warning}
                style={{ marginTop: 1 }}
              />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={text.label}>{item.label}</Text>
                <Text style={text.small}>{item.hint}</Text>
              </View>
            </View>
          ))}
        </View>
        {!state.prerequisites.ready ? (
          <Button title="Fehlende Angaben ergänzen" variant="outline" icon="create-outline" onPress={() => router.push({ pathname: "/objekt/[id]", params: { id: propertyId } })} />
        ) : null}

        {state.explanation === "needs_consent" && consent.required ? (
          <View style={{ gap: space.xs }}>
            <Text style={text.small}>
              Die Berechnung braucht keine KI. Auf Wunsch formuliert eine KI zusätzlich eine Erklärung in Worten – nur mit Ihrer Einwilligung.
            </Text>
            <Button title="KI-Erklärung aktivieren" variant="ghost" icon="sparkles-outline" onPress={() => consent.guard(refresh)} />
          </View>
        ) : state.explanation !== "unavailable" ? (
          <Text style={text.small}>Zusätzlich formuliert eine KI eine Erklärung in Worten – ausschliesslich aus den berechneten Daten.</Text>
        ) : null}

        <AvailabilityNotice availability={state.availability} />
        {state.availability.available ? <QuotaHint quota={state.availability.quota} /> : null}
        <JobProgressRow job={job} running={running} label="Bewertung wird berechnet" />
        {jobError ? <Notice tone="error">{toolErrorMessage(jobError)}</Notice> : null}
        <Button
          title={hasValuation ? "Neue Bewertung" : "Bewertung starten"}
          icon="speedometer-outline"
          onPress={() => start.mutate()}
          loading={start.isPending || running}
          disabled={blocked}
        />
      </Card>

      {state.detail ? (
        <View style={[{ gap: space.lg }, switching && { opacity: 0.5 }]}>
          <Result detail={state.detail} suffix={suffix} rent={state.rent} propertyId={propertyId} />
        </View>
      ) : null}

      {state.history.length > 1 ? (
        <Card>
          <SectionTitle>Frühere Bewertungen</SectionTitle>
          {state.history.map((item) => {
            const active = item.id === state.selectedId;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Bewertung vom ${formatDateTimeFull(item.createdAt)}, ${item.statusLabel}`}
                onPress={() => onSelect(item.id)}
                style={[toolStyles.listItem, active && toolStyles.listItemActive]}
              >
                <View style={toolStyles.between}>
                  <Text style={text.small}>{formatDateTimeFull(item.createdAt)}</Text>
                  <Text style={text.label}>{item.estimatedValue !== null ? `${chf(item.estimatedValue)}${suffix}` : "keine Zahl"}</Text>
                </View>
                <Badge label={item.statusLabel} tone={BADGE_TONE[item.statusTone]} />
              </Pressable>
            );
          })}
        </Card>
      ) : null}

      <Card>
        <SectionTitle>So entsteht die Schätzung</SectionTitle>
        <Step
          n={1}
          title="Vergleichsangebote finden"
          body={`Echte, veröffentlichte Inserate auf Immovia (ohne Demo-Inserate) mit gleicher Objektart, ähnlicher Fläche (±${Math.round(state.method.areaTolerance * 100)} %) im Umkreis von ${state.method.radiusKm} km, höchstens ${state.method.maxAgeDays} Tage alt.`}
        />
        <Step
          n={2}
          title="Robust rechnen"
          body={`Median der Preise pro m² multipliziert mit Ihrer Fläche; die Spanne entspricht dem 25. bis 75. Perzentil. Unter ${state.method.minComparables} Vergleichsangeboten wird keine Zahl angezeigt.`}
        />
        <Step
          n={3}
          title="Ehrlich kennzeichnen"
          body="Angebotspreise sind keine bezahlten Preise. Der Vertrauensgrad ist deshalb höchstens «mittel». Zahlen berechnet nie die KI."
        />
        <View style={toolStyles.box}>
          <View style={toolStyles.between}>
            <Text style={[text.label, { flex: 1 }]}>Lizenzierte Marktdaten (Transaktionspreise)</Text>
            <Badge label={state.method.avmConfigured ? "Angebunden" : "Nicht angebunden"} tone={state.method.avmConfigured ? "green" : "neutral"} />
          </View>
          <Text style={text.small}>Schnittstelle für Anbieter wie IAZI/CIFI, Wüest Partner, PriceHubble oder Fahrländer Partner vorbereitet.</Text>
        </View>
      </Card>
      {consent.dialog}
    </ScrollView>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <View style={{ gap: 2 }}>
      <Text style={text.label}>
        {n}. {title}
      </Text>
      <Text style={text.small}>{body}</Text>
    </View>
  );
}

/** Ergebnis einer gespeicherten Bewertung – ehrlich gekennzeichnet (Angebots- ≠ Transaktionspreise). */
function Result({ detail: v, suffix, rent, propertyId }: { detail: ValuationDetail; suffix: string; rent: boolean; propertyId: string }) {
  const router = useRouter();
  return (
    <>
      <Card>
        <View style={toolStyles.wrap}>
          <Badge label={v.statusLabel} tone={BADGE_TONE[v.statusTone]} />
          <Text style={text.small}>Bewertung vom {formatDate(v.createdAt)}</Text>
        </View>

        {v.hasNumbers && v.estimatedValue !== null ? (
          <>
            <View style={{ gap: 2 }}>
              <Text style={text.small}>{rent ? "Geschätzte Nettomiete pro Monat" : "Geschätzter Marktwert"} – auf Basis von Angebotspreisen</Text>
              <Text style={styles.estimate}>
                {chf(v.estimatedValue)}
                {suffix ? <Text style={styles.estimateSuffix}>{suffix}</Text> : null}
              </Text>
            </View>
            {v.valueLow !== null && v.valueHigh !== null ? <RangeBar low={v.valueLow} estimate={v.estimatedValue} high={v.valueHigh} suffix={suffix} /> : null}
            {v.summary ? <Text style={text.small}>{v.summary}</Text> : null}
            {v.suggestedListPrice !== null ? (
              <View style={[toolStyles.box, { backgroundColor: colors.mint100, borderColor: colors.mint200 }]}>
                <Text style={text.small}>Möglicher Inseratepreis</Text>
                <Text style={[text.heading, { fontSize: 22 }]}>
                  {chf(v.suggestedListPrice)}
                  {suffix}
                </Text>
                {v.listPriceExplanation ? <Text style={text.small}>{v.listPriceExplanation}</Text> : null}
              </View>
            ) : null}
            <View style={toolStyles.box}>
              <View style={toolStyles.between}>
                <Text style={text.small}>Vertrauensgrad</Text>
                <Badge label={v.confidenceLabel} tone={BADGE_TONE[v.confidenceTone]} />
              </View>
              {v.confidenceExplanation ? <Text style={text.small}>{v.confidenceExplanation}</Text> : null}
            </View>
          </>
        ) : (
          <View style={{ gap: space.md }}>
            <View style={{ gap: space.xs }}>
              <Text style={text.heading}>Noch keine belastbare Bewertung möglich</Text>
              <Text style={text.small}>
                Immovia zeigt bewusst keine Zahl, wenn zu wenige vergleichbare Daten vorliegen. Eine geschätzte Zahl ohne Grundlage wäre irreführend.
              </Text>
            </View>
            {v.missing.length ? (
              <View style={{ gap: space.xs }}>
                <Text style={text.label}>Was fehlt</Text>
                <BulletList items={v.missing} />
              </View>
            ) : null}
            {v.suggestions.length ? (
              <View style={{ gap: space.xs }}>
                <Text style={text.label}>Was helfen würde</Text>
                <BulletList items={v.suggestions} />
              </View>
            ) : null}
          </View>
        )}

        {v.notes.length ? (
          <View style={[toolStyles.box, { backgroundColor: colors.warningBg, borderColor: colors.warningBg }]}>
            <BulletList items={v.notes} color={colors.warning} />
          </View>
        ) : null}
      </Card>

      {v.explanation ? (
        <Card>
          <SectionTitle>Erklärung</SectionTitle>
          <Text style={text.small}>KI-generiert, ausschliesslich auf Basis der oben berechneten Daten. Zahlen stammen nie von der KI.</Text>
          <Text style={text.body}>{v.explanation}</Text>
        </Card>
      ) : null}

      <Card>
        <SectionTitle>Datenquellen</SectionTitle>
        <Text style={text.small}>Woher die Zahlen stammen.</Text>
        {v.sources.length === 0 ? <Text style={text.small}>Keine Datenquelle verwendet.</Text> : null}
        {v.sources.map((source) => (
          <View key={`${source.name}-${source.typeLabel}`} style={{ gap: 2 }}>
            <Text style={text.label}>
              {source.name} <Text style={[text.small, { fontWeight: "400" }]}>({source.typeLabel})</Text>
            </Text>
            {source.description ? <Text style={text.small}>{source.description}</Text> : null}
            <Text style={text.small}>
              {[
                source.dataAsOf ? `Stand ${formatDate(source.dataAsOf)}` : null,
                source.recordCount !== null ? `${source.recordCount} Datensätze` : null,
                source.licenseNote,
              ]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          </View>
        ))}
      </Card>

      <Card>
        <SectionTitle>Qualität und Aktualität der Daten</SectionTitle>
        <Text style={text.small}>Grundlage dieser Bewertung.</Text>
        {v.quality.map((row) => (
          <View key={row.label} style={styles.qualityRow}>
            <Text style={[text.small, { flex: 1 }]}>{row.label}</Text>
            <Text style={[text.label, { flex: 1, textAlign: "right" }]}>{row.value}</Text>
          </View>
        ))}
      </Card>

      {v.comparables.length ? (
        <Card>
          <SectionTitle>Vergleichsobjekte</SectionTitle>
          <Text style={text.small}>
            Die {v.comparables.length} ähnlichsten von {v.sampleSize} ausgewerteten Angeboten.
          </Text>
          <Text style={text.small}>
            <Text style={{ fontWeight: "700", color: colors.foreground }}>Angebotspreise, keine Transaktionspreise.</Text> Es handelt sich um Preise, zu denen
            vergleichbare Objekte auf Immovia angeboten werden – nicht um tatsächlich bezahlte Preise.
          </Text>
          <Disclosure title={`${v.comparables.length} Vergleichsobjekte anzeigen`}>
            {v.comparables.map((c) => (
              <View key={c.id} style={toolStyles.listItem}>
                <View style={toolStyles.between}>
                  <Text style={[text.label, { flex: 1 }]}>{c.location}</Text>
                  <Text style={text.label}>
                    {chf(c.price)}
                    {suffix}
                  </Text>
                </View>
                <Text style={text.small}>
                  {[
                    c.typeLabel,
                    c.rooms !== null ? `${String(c.rooms).replace(/\.0$/, "")} Zimmer` : null,
                    c.area !== null ? `${formatNumber(c.area)} m² ${v.areaLabel}` : null,
                    c.pricePerSqm !== null ? `CHF ${rent ? (Math.round(c.pricePerSqm * 10) / 10).toFixed(1) : formatNumber(c.pricePerSqm)}/m²` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
                <Text style={text.small}>
                  Inseriert am {formatDate(c.observedAt)}
                  {c.distanceKm !== null ? ` · ${c.distanceKm.toFixed(1)} km entfernt` : ""}
                </Text>
                {c.slug ? (
                  <Pressable
                    accessibilityRole="link"
                    accessibilityLabel={`Inserat in ${c.location} ansehen`}
                    onPress={() => router.push({ pathname: "/inserat/[slug]", params: { slug: c.slug! } })}
                    style={{ minHeight: 44, justifyContent: "center" }}
                  >
                    <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 14.5 }}>Inserat ansehen</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
          </Disclosure>
        </Card>
      ) : null}

      <Card>
        <SectionTitle>Wertfaktoren</SectionTitle>
        <Text style={text.small}>
          Diese Faktoren werden aus Ihren erfassten Objektdaten abgeleitet. Sie sind <Text style={{ fontWeight: "700", color: colors.foreground }}>qualitativ</Text>{" "}
          und fliessen nicht rechnerisch in die Schätzung ein. Sie helfen einzuordnen, ob Ihr Objekt eher im oberen oder unteren Bereich der Spanne liegen
          könnte.
        </Text>
        <Factors title="Können den Wert erhöhen" icon="trending-up" color={colors.forest} factors={v.positive} />
        <Factors title="Können den Wert reduzieren" icon="trending-down" color={colors.warning} factors={v.negative} />
      </Card>

      <View style={[toolStyles.box, { backgroundColor: colors.mutedBg }]}>
        <Text style={text.small}>{v.disclaimer}</Text>
      </View>

      <Button
        title="Bericht als PDF (auf der Website)"
        variant="ghost"
        icon="open-outline"
        onPress={() => {
          void WebBrowser.openBrowserAsync(`${CONFIG.siteUrl}/dashboard/immobilien/${propertyId}/bewertung?bewertung=${v.id}`);
        }}
      />
      <Text style={[text.small, { textAlign: "center", marginTop: -space.sm }]}>
        Den PDF-Bericht gibt es im Verkäuferbereich der Website. Dort müssen Sie sich gegebenenfalls erneut anmelden.
      </Text>
    </>
  );
}

function Factors({
  title,
  icon,
  color,
  factors,
}: {
  title: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  color: string;
  factors: ValuationDetail["positive"];
}) {
  return (
    <View style={toolStyles.box}>
      <View style={toolStyles.row}>
        <Ionicons name={icon} size={17} color={color} />
        <Text style={[text.label, { color }]}>{title}</Text>
      </View>
      {factors.length === 0 ? <Text style={text.small}>Keine erkannt.</Text> : null}
      {factors.map((factor) => (
        <View key={factor.key} style={{ marginTop: 4 }}>
          <Text style={text.label}>{factor.label}</Text>
          {factor.detail ? <Text style={text.small}>{factor.detail}</Text> : null}
        </View>
      ))}
    </View>
  );
}

/** Spanne P25–P75 mit Markierung der Schätzung (rein visuell, Werte zusätzlich als Text). */
function RangeBar({ low, estimate, high, suffix }: { low: number; estimate: number; high: number; suffix: string }) {
  const span = Math.max(1, high - low);
  const min = low - span * 0.35;
  const max = high + span * 0.35;
  const pos = (value: number) => Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
  return (
    <View style={{ gap: space.sm }}>
      <View style={styles.track} accessible={false} importantForAccessibility="no-hide-descendants">
        <View style={[styles.range, { left: `${pos(low)}%`, right: `${100 - pos(high)}%` }]} />
        <View style={[styles.marker, { left: `${pos(estimate)}%` }]} />
      </View>
      <View style={toolStyles.between}>
        <View>
          <Text style={text.label}>
            {chf(low)}
            {suffix}
          </Text>
          <Text style={text.small}>unterer Wert</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={text.label}>
            {chf(high)}
            {suffix}
          </Text>
          <Text style={text.small}>oberer Wert</Text>
        </View>
      </View>
      <Text style={text.small}>Spanne der mittleren 50 % der Vergleichsangebote</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  estimate: { fontSize: 34, fontWeight: "800", letterSpacing: -0.8, color: colors.forest },
  estimateSuffix: { fontSize: 18, fontWeight: "700", color: colors.muted },
  qualityRow: { flexDirection: "row", gap: space.md, paddingBottom: space.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  track: { height: 12, borderRadius: radius.full, backgroundColor: colors.mint100, marginVertical: 6 },
  range: { position: "absolute", top: 0, bottom: 0, borderRadius: radius.full, backgroundColor: colors.brand, opacity: 0.45 },
  marker: { position: "absolute", top: -6, width: 6, height: 24, marginLeft: -3, borderRadius: 3, backgroundColor: colors.forest, borderWidth: 1, borderColor: colors.white },
});
