import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as React from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";

import { AvailabilityNotice, Card, Disclosure, JobProgressRow, QuotaHint, toolErrorMessage, toolStyles, useTextAiConsent } from "@/components/tools";
import { Badge, Button, EmptyState, Field, Loading, Notice, SectionTitle } from "@/components/ui";
import {
  applyDescriptionSection,
  compareKey,
  confirmListingTexts,
  descriptionState,
  formatDateTimeFull,
  requestDescription,
  toDraft,
  toLines,
  type DescriptionRequest,
  type DescriptionSectionKey,
  type DescriptionState,
  type DescriptionStyle,
  type SectionValue,
} from "@/lib/api-tools";
import { useAuth } from "@/lib/auth";
import { ApiError, useJob } from "@/lib/jobs";
import { colors, space, text } from "@/lib/theme";

type Drafts = Record<DescriptionSectionKey, string>;
type Message = { tone: "success" | "error" | "info"; text: string };

function draftsFrom(state: DescriptionState): Drafts {
  return Object.fromEntries(state.sections.map((s) => [s.key, toDraft(state.version?.content[s.key])])) as Drafts;
}

export default function ListingTextsScreen() {
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();
  const { userId } = useAuth();
  const [versionId, setVersionId] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<Message | null>(null);
  const query = useQuery({
    queryKey: ["description", propertyId, versionId],
    queryFn: () => descriptionState(propertyId, versionId),
    enabled: Boolean(userId),
    placeholderData: keepPreviousData,
  });

  let body: React.ReactNode;
  if (!userId) body = <EmptyState icon="lock-closed-outline" title="Bitte anmelden" description="Melden Sie sich an, um Inseratetexte zu erstellen." />;
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
    body = (
      <Studio
        // Neue Version = neue Entwürfe (wie auf der Website)
        key={query.data.version?.id ?? "neu"}
        propertyId={propertyId}
        state={query.data}
        message={message}
        setMessage={setMessage}
        onSelectVersion={setVersionId}
      />
    );
  }
  return (
    <>
      <Stack.Screen options={{ title: "KI-Texte" }} />
      {body}
    </>
  );
}

/**
 * KI-Inseratetexte: Stil wählen, Texte erstellen, je Abschnitt bearbeiten, neu formulieren
 * und ins Inserat übernehmen (mit Rückfrage, bevor ein eigener Text ersetzt wird).
 */
function Studio({
  propertyId,
  state,
  message,
  setMessage,
  onSelectVersion,
}: {
  propertyId: string;
  state: DescriptionState;
  message: Message | null;
  setMessage: (message: Message | null) => void;
  onSelectVersion: (id: string | null) => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { availability, version, listingTexts } = state;
  const consent = useTextAiConsent(Boolean(availability.consentRequired));
  const [style, setStyle] = React.useState<DescriptionStyle>(version?.style ?? "modern");
  const [drafts, setDrafts] = React.useState<Drafts>(() => draftsFrom(state));
  const [aiTexts, setAiTexts] = React.useState<Drafts>(() => draftsFrom(state));
  // Version, aus der ein Abschnitt stammt (neu formulierte Abschnitte sind eigene Versionen)
  const [sources, setSources] = React.useState<Partial<Record<DescriptionSectionKey, string>>>({});
  const [generateJobId, setGenerateJobId] = React.useState<string | null>(null);
  const [rephrase, setRephrase] = React.useState<{ section: DescriptionSectionKey; jobId: string } | null>(null);
  const [applying, setApplying] = React.useState<DescriptionSectionKey | null>(null);
  const [starting, setStarting] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);

  const sectionLabel = (key: DescriptionSectionKey) => state.sections.find((s) => s.key === key)?.label ?? key;
  const styleLabel = (key: DescriptionStyle) => state.styles.find((s) => s.key === key)?.label ?? key;
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["description", propertyId] });
    queryClient.invalidateQueries({ queryKey: ["workspace", propertyId] });
    queryClient.invalidateQueries({ queryKey: ["my-properties"] });
  };

  const generateJob = useJob(generateJobId, {
    onSuccess: (job) => {
      const result = job.result as { descriptionId?: string } | null;
      setGenerateJobId(null);
      setMessage({ tone: "success", text: "Die Texte sind erstellt. Bitte prüfen Sie jeden Abschnitt vor der Übernahme." });
      if (result?.descriptionId) onSelectVersion(result.descriptionId);
      refresh();
    },
    onError: (job) => {
      setGenerateJobId(null);
      if (job.consentRequired) consent.requestConsent(generate);
      else setMessage({ tone: "error", text: job.error ?? "Die Texte konnten nicht erstellt werden." });
    },
  });

  const rephraseJob = useJob(rephrase?.jobId ?? null, {
    onSuccess: (job) => {
      const result = job.result as { descriptionId?: string; section?: DescriptionSectionKey; value?: SectionValue | null } | null;
      const section = result?.section ?? rephrase?.section;
      if (section && result?.value !== undefined && result.value !== null) {
        const value = toDraft(result.value);
        setDrafts((current) => ({ ...current, [section]: value }));
        setAiTexts((current) => ({ ...current, [section]: value }));
        if (result.descriptionId) setSources((current) => ({ ...current, [section]: result.descriptionId }));
        setMessage({ tone: "success", text: `«${sectionLabel(section)}» wurde neu formuliert.` });
      }
      setRephrase(null);
      refresh();
    },
    onError: (job) => {
      const section = rephrase?.section;
      setRephrase(null);
      if (job.consentRequired && section) consent.requestConsent(() => startRephrase(section));
      else setMessage({ tone: "error", text: job.error ?? "Der Abschnitt konnte nicht neu formuliert werden." });
    },
  });

  const busy = starting || generateJob.running || rephraseJob.running;
  const aiBlocked = !availability.available;

  /** Startet einen Auftrag; bei fehlender Einwilligung erst den Dialog zeigen und danach wiederholen. */
  async function startJob(input: DescriptionRequest, retry: () => void, onStarted: (jobId: string) => void) {
    setStarting(true);
    setMessage(null);
    try {
      const res = await requestDescription(input);
      onStarted(res.jobId);
    } catch (error) {
      if (error instanceof ApiError && error.consentRequired) consent.requestConsent(retry);
      else setMessage({ tone: "error", text: toolErrorMessage(error) });
    } finally {
      setStarting(false);
    }
  }

  function generate() {
    consent.guard(() => {
      void startJob({ propertyId, style, mode: "full" }, generate, setGenerateJobId);
    });
  }

  function startRephrase(section: DescriptionSectionKey) {
    if (!version) return;
    consent.guard(() => {
      const draft = drafts[section];
      void startJob(
        {
          propertyId,
          style,
          mode: "rephrase",
          section,
          baseVersionId: sources[section] ?? version.id,
          ...(section === "highlights" ? { currentItems: toLines(draft).slice(0, 12).map((item) => item.slice(0, 200)) } : { currentText: draft.slice(0, 12000) }),
        },
        () => startRephrase(section),
        (jobId) => setRephrase({ section, jobId }),
      );
    });
  }

  async function apply(section: DescriptionSectionKey, overwrite = false) {
    if (!version) return;
    setApplying(section);
    setMessage(null);
    try {
      const draft = drafts[section];
      const res = await applyDescriptionSection({
        propertyId,
        descriptionId: sources[section] ?? version.id,
        section,
        value: section === "highlights" ? toLines(draft) : draft,
        confirmOverwrite: overwrite,
      });
      if (res.needsConfirmation) {
        const current = toDraft(res.currentValue) || "–";
        Alert.alert(
          "Bestehenden Text ersetzen?",
          `Im Inserat steht bei «${sectionLabel(section)}» ein Text, der nicht von der KI stammt oder nachträglich bearbeitet wurde. Er wird durch den neuen Text ersetzt.\n\nAktueller Text:\n${current.length > 400 ? `${current.slice(0, 400)} …` : current}`,
          [
            { text: "Abbrechen", style: "cancel" },
            { text: "Ersetzen", style: "destructive", onPress: () => void apply(section, true) },
          ],
        );
        return;
      }
      setMessage({ tone: "success", text: `«${sectionLabel(section)}» ist im Inserat.` });
      refresh();
    } catch (error) {
      setMessage({ tone: "error", text: toolErrorMessage(error) });
    } finally {
      setApplying(null);
    }
  }

  const confirm = useMutation({
    mutationFn: () => confirmListingTexts(propertyId),
    onMutate: () => setConfirming(true),
    onSuccess: (res) => {
      setMessage({ tone: "success", text: res.message });
      refresh();
    },
    onError: (error) => setMessage({ tone: "error", text: toolErrorMessage(error) }),
    onSettled: () => setConfirming(false),
  });

  const { confirmedAt, canConfirm } = state.confirmation;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
      <ScrollView contentContainerStyle={toolStyles.screen} keyboardShouldPersistTaps="handled">
        <View style={{ gap: space.xs }}>
          <Text style={text.title}>Beschreibung erstellen</Text>
          <Text style={[text.body, { color: colors.muted }]}>
            Lassen Sie Inseratetexte aus Ihren Angaben erstellen, passen Sie sie an und übernehmen Sie jeden Abschnitt einzeln ins Inserat.
          </Text>
        </View>

        {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}

        <Card>
          <SectionTitle>{version ? "Neue Texte erstellen" : "Texte mit KI erstellen"}</SectionTitle>
          <Text style={text.small}>
            Die KI schreibt ausschliesslich aus Ihren erfassten Angaben – ohne erfundene Ausstattung, Renovationen oder Lagevorteile. Sie entscheiden für
            jeden Abschnitt, ob er ins Inserat kommt.
          </Text>
          <View accessibilityRole="radiogroup" accessibilityLabel="Schreibstil" style={{ gap: space.sm }}>
            {state.styles.map((option) => {
              const selected = option.key === style;
              return (
                <Pressable
                  key={option.key}
                  accessibilityRole="radio"
                  accessibilityState={{ selected, disabled: busy }}
                  disabled={busy}
                  onPress={() => setStyle(option.key)}
                  style={[toolStyles.listItem, selected && toolStyles.listItemActive]}
                >
                  <Text style={text.label}>{option.label}</Text>
                  <Text style={text.small}>{option.description}</Text>
                </Pressable>
              );
            })}
          </View>
          <AvailabilityNotice availability={availability} />
          {availability.available ? <QuotaHint quota={availability.quota} /> : null}
          {availability.available && consent.required ? (
            <Text style={text.small}>Vor dem ersten Erstellen fragen wir nach Ihrer Einwilligung zur KI-Verarbeitung.</Text>
          ) : null}
          <JobProgressRow job={generateJob.job} running={generateJob.running} label="Die Texte werden erstellt (dauert meist unter einer Minute)" />
          {generateJob.error ? <Notice tone="error">{toolErrorMessage(generateJob.error)}</Notice> : null}
          <Button
            title={version ? "Neu erstellen" : "Texte erstellen"}
            icon="sparkles-outline"
            onPress={generate}
            loading={(starting && !rephrase) || generateJob.running}
            disabled={busy || aiBlocked}
          />
        </Card>

        {version ? (
          <>
            <View style={{ gap: space.xs }}>
              <SectionTitle>Texte prüfen und übernehmen</SectionTitle>
              <Text style={text.small}>
                Stil «{styleLabel(version.style)}», erstellt am {formatDateTimeFull(version.createdAt)}
                {version.model ? ` mit KI (${version.model})` : " mit KI"}. KI-Texte können Fehler enthalten – bitte prüfen Sie jeden Abschnitt.
              </Text>
            </View>

            {state.sections.map((meta) => {
              const section = meta.key;
              const draft = drafts[section];
              const listingValue = listingTexts[section];
              const listingKey = compareKey(section, listingValue);
              const draftKey = compareKey(section, draft);
              const inListing = Boolean(listingKey) && listingKey === draftKey;
              const differs = Boolean(listingKey) && listingKey !== draftKey;
              const length = section === "highlights" ? toLines(draft).length : draft.length;
              const tooLong = length > meta.max;
              const isRephrasing = rephrase?.section === section;
              const changedFromAi = draft !== aiTexts[section];
              const counter = section === "highlights" ? `${length} von höchstens 12 Einträgen.` : `${length} / ${meta.max} Zeichen.`;
              return (
                <Card key={section}>
                  {inListing ? (
                    <Badge tone="green" label="Im Inserat" />
                  ) : differs ? (
                    <Badge tone="amber" label="Inserat hat einen anderen Text" />
                  ) : (
                    <Badge tone="neutral" label="Im Inserat noch leer" />
                  )}
                  {!aiTexts[section].trim() && !draft.trim() ? (
                    <Text style={text.small}>
                      {section === "location"
                        ? "Die KI hat keinen Lagetext erstellt, weil ausser dem Ort keine Lageangaben erfasst sind. Sie können selbst einen Text schreiben."
                        : "Für diesen Abschnitt liegen zu wenige Angaben vor. Sie können selbst einen Text schreiben."}
                    </Text>
                  ) : null}
                  <Field
                    label={meta.label}
                    value={draft}
                    onChangeText={(value) => setDrafts((current) => ({ ...current, [section]: value }))}
                    multiline={meta.rows > 2}
                    editable={!isRephrasing}
                    style={meta.rows > 2 ? { minHeight: Math.min(260, meta.rows * 24) } : undefined}
                    hint={`${meta.hint} ${counter}`}
                    error={tooLong ? `Zu lang. ${counter}` : null}
                  />
                  {changedFromAi ? <Text style={text.small}>Von Ihnen bearbeitet.</Text> : null}
                  {differs && listingValue ? (
                    <Disclosure title="Aktuellen Text im Inserat anzeigen">
                      <View style={toolStyles.box}>
                        <Text style={[text.body, { fontSize: 15 }]}>{toDraft(listingValue)}</Text>
                      </View>
                    </Disclosure>
                  ) : null}
                  {isRephrasing ? <JobProgressRow job={rephraseJob.job} running={rephraseJob.running} label="Abschnitt wird neu formuliert" /> : null}
                  {isRephrasing && rephraseJob.error ? <Notice tone="error">{toolErrorMessage(rephraseJob.error)}</Notice> : null}
                  <Button
                    title="Ins Inserat übernehmen"
                    icon="cloud-upload-outline"
                    onPress={() => void apply(section)}
                    loading={applying === section}
                    disabled={tooLong || busy || applying !== null || inListing}
                  />
                  <Button
                    title="Text neu formulieren"
                    variant="outline"
                    icon="refresh-outline"
                    onPress={() => startRephrase(section)}
                    disabled={busy || aiBlocked || applying !== null}
                  />
                  {changedFromAi ? (
                    <Button
                      title="KI-Text wiederherstellen"
                      variant="ghost"
                      icon="arrow-undo-outline"
                      onPress={() => setDrafts((current) => ({ ...current, [section]: aiTexts[section] }))}
                      disabled={busy}
                    />
                  ) : null}
                </Card>
              );
            })}
          </>
        ) : null}

        <Card>
          <SectionTitle>{confirmedAt ? "Texte bestätigt" : "Texte noch nicht bestätigt"}</SectionTitle>
          <Text style={text.small}>
            {confirmedAt
              ? `Bestätigt am ${formatDateTimeFull(confirmedAt)}. Ändern Sie einen Text, müssen Sie ihn erneut bestätigen.`
              : canConfirm
                ? "Bitte bestätigen Sie, dass die Texte im Inserat korrekt sind. Erst dann kann das Inserat veröffentlicht werden."
                : "Übernehmen Sie mindestens Titel und ausführliche Beschreibung ins Inserat, dann können Sie die Texte bestätigen."}
          </Text>
          {!confirmedAt && canConfirm ? <Button title="Texte bestätigen" icon="checkmark-circle-outline" onPress={() => confirm.mutate()} loading={confirming} /> : null}
          <Button title="Inserat bearbeiten" variant="outline" icon="create-outline" onPress={() => router.push({ pathname: "/objekt/[id]", params: { id: propertyId } })} />
        </Card>

        <Card>
          <Disclosure title={`Welche Angaben erhält die KI? (${state.facts.length})`}>
            <Text style={text.small}>
              Nur diese erfassten Angaben werden übermittelt – ohne Strasse, Hausnummer, Koordinaten, Namen oder Kontaktdaten. Fehlt etwas Wichtiges, ergänzen
              Sie es bei den Objektdaten und erstellen Sie die Texte neu.
            </Text>
            {state.facts.map((fact) => (
              <View key={fact.label} style={{ flexDirection: "row", gap: space.md }}>
                <Text style={[text.small, { flex: 2 }]}>{fact.label}</Text>
                <Text style={[text.small, { flex: 3, color: colors.foreground, fontWeight: "600" }]}>{fact.value}</Text>
              </View>
            ))}
          </Disclosure>
        </Card>

        {state.history.length ? (
          <Card>
            <SectionTitle>Versionen</SectionTitle>
            {state.history.map((item) => {
              const active = item.id === version?.id;
              const title = item.rephrasedSection ? `Neu formuliert: ${sectionLabel(item.rephrasedSection)}` : "Alle Texte";
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active, disabled: busy }}
                  accessibilityLabel={`${title}, ${formatDateTimeFull(item.createdAt)}`}
                  disabled={busy}
                  onPress={() => {
                    setMessage(null);
                    onSelectVersion(item.id);
                  }}
                  style={[toolStyles.listItem, active && toolStyles.listItemActive]}
                >
                  <View style={toolStyles.between}>
                    <Text style={[text.label, { flex: 1 }]}>{title}</Text>
                    {item.appliedAt ? <Badge tone="green" label="übernommen" /> : null}
                  </View>
                  <Text style={text.small}>
                    {formatDateTimeFull(item.createdAt)} · {styleLabel(item.style)}
                  </Text>
                </Pressable>
              );
            })}
          </Card>
        ) : null}
        {consent.dialog}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
