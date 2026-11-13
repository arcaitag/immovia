import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as React from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from "react-native";

import { AiConsentSheet } from "@/components/ai-consent-sheet";
import { Badge, Button, Chip, EmptyState, Loading, Notice, SectionTitle, ToggleRow } from "@/components/ui";
import {
  acceptEnhancement,
  confirmProposal,
  discardProposal,
  previewAdjustments,
  requestImageAi,
  restoreOriginal,
  studioImage,
  studioStatus,
  suggestAdjustments,
  type Adjustments,
  type Availability,
  type DesignCapability,
  type Quota,
  type StudioImage,
  type StudioImageDetail,
  type StudioStatus,
} from "@/lib/api-studio";
import { useAuth } from "@/lib/auth";
import { CONFIG } from "@/lib/config";
import { imageUrl } from "@/lib/format";
import { ApiError, jobProgressText, pollJob } from "@/lib/jobs";
import { errorMessage } from "@/lib/labels";
import { colors, radius, space, text } from "@/lib/theme";

const messageOf = (error: unknown) => (error instanceof ApiError ? error.message : errorMessage(error));
const isAbort = (error: unknown) => error instanceof Error && error.name === "AbortError";

function aspectOf(size: { width?: number | null; height?: number | null } | null | undefined): number {
  return size?.width && size.height ? size.width / size.height : 4 / 3;
}

/** Ein Bild im Bilderstudio: automatische Optimierung, Designvorschlag mit KI oder Prüfung eines Vorschlags. */
export default function StudioImageScreen() {
  const { imageId } = useLocalSearchParams<{ imageId: string }>();
  const { userId } = useAuth();
  const query = useQuery({ queryKey: ["studio-image", imageId], queryFn: () => studioImage(imageId), enabled: Boolean(userId) });

  if (!userId) {
    return (
      <>
        <Stack.Screen options={{ title: "Bild bearbeiten" }} />
        <EmptyState icon="lock-closed-outline" title="Bitte anmelden" description="Melden Sie sich an, um Ihre Bilder zu bearbeiten." />
      </>
    );
  }
  if (query.isPending) {
    return (
      <>
        <Stack.Screen options={{ title: "Bild bearbeiten" }} />
        <Loading />
      </>
    );
  }
  if (query.isError) {
    return (
      <View style={{ padding: space.lg }}>
        <Stack.Screen options={{ title: "Bild bearbeiten" }} />
        <Notice tone="error">{errorMessage(query.error)}</Notice>
      </View>
    );
  }
  if (!query.data) {
    return (
      <>
        <Stack.Screen options={{ title: "Bild bearbeiten" }} />
        <EmptyState icon="image-outline" title="Nicht gefunden" description="Dieses Bild gibt es nicht mehr oder es gehört zu einem anderen Konto." />
      </>
    );
  }

  const { image } = query.data;
  if (image.is_ai_visualization && image.status === "review") {
    return (
      <>
        <Stack.Screen options={{ title: "KI-Vorschlag prüfen" }} />
        <ReviewPanel key={image.id} detail={query.data} />
      </>
    );
  }
  return (
    <>
      <Stack.Screen options={{ title: "Bild bearbeiten" }} />
      <ImageEditor key={image.id} image={image} />
    </>
  );
}

// --- Bearbeiten ----------------------------------------------------------------

function ImageEditor({ image }: { image: StudioImage }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const statusQuery = useQuery({ queryKey: ["studio-status"], queryFn: studioStatus, staleTime: 0 });
  const status = statusQuery.data;

  const [suggestion, setSuggestion] = React.useState<{ adjustments: Adjustments; dataUrl: string; aspect: number } | null>(null);
  const [view, setView] = React.useState<"original" | "current">("current");
  const [busy, setBusy] = React.useState<"suggest" | "accept" | "restore" | null>(null);
  const [message, setMessage] = React.useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [aiRunning, setAiRunning] = React.useState(false);

  const currentUrl = imageUrl(image, "md");
  const originalUrl = image.external_url ? currentUrl : (imageUrl({ display_path: image.base_path }, "md") ?? currentUrl);
  const notEditable = image.external_url
    ? "Demo-Bilder können nicht bearbeitet werden."
    : image.is_ai_visualization
      ? "Dies ist eine KI-Visualisierung. Sie wird nicht weiter bearbeitet; bearbeiten Sie stattdessen das Originalbild."
      : !image.base_path || image.status !== "ready"
        ? "Dieses Bild ist noch nicht vollständig verarbeitet."
        : !currentUrl
          ? "Für dieses Bild ist keine Vorschau verfügbar."
          : null;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["studio-image", image.id] });
    queryClient.invalidateQueries({ queryKey: ["studio-images", image.property_id] });
    queryClient.invalidateQueries({ queryKey: ["studio-status"] });
    queryClient.invalidateQueries({ queryKey: ["workspace", image.property_id] });
    queryClient.invalidateQueries({ queryKey: ["my-properties"] });
  };

  async function suggest() {
    setBusy("suggest");
    setMessage(null);
    try {
      const adjustments = await suggestAdjustments(image.id);
      const preview = await previewAdjustments(image.id, adjustments);
      setSuggestion({ adjustments, dataUrl: preview.dataUrl, aspect: aspectOf(preview) });
      setView("current");
    } catch (error) {
      setMessage({ tone: "error", text: messageOf(error) });
    } finally {
      setBusy(null);
    }
  }

  async function accept() {
    if (!suggestion) return;
    setBusy("accept");
    setMessage(null);
    try {
      await acceptEnhancement(image.id, suggestion.adjustments);
      setSuggestion(null);
      setMessage({ tone: "success", text: "Die Optimierung wurde übernommen." });
      refresh();
    } catch (error) {
      setMessage({ tone: "error", text: messageOf(error) });
    } finally {
      setBusy(null);
    }
  }

  function confirmRestore() {
    Alert.alert("Original wiederherstellen?", "Die optimierte Version wird entfernt und wieder das Originalfoto angezeigt.", [
      { text: "Abbrechen", style: "cancel" },
      {
        text: "Wiederherstellen",
        style: "destructive",
        onPress: () => {
          setBusy("restore");
          setMessage(null);
          restoreOriginal(image.id)
            .then(() => {
              setSuggestion(null);
              setMessage({ tone: "success", text: "Das Original wird wieder angezeigt." });
              refresh();
            })
            .catch((error: unknown) => setMessage({ tone: "error", text: messageOf(error) }))
            .finally(() => setBusy(null));
        },
      },
    ]);
  }

  const canCompare = Boolean(suggestion) || image.is_enhanced;
  const shownUrl = view === "original" && canCompare ? originalUrl : (suggestion?.dataUrl ?? currentUrl);
  const shownAspect = suggestion && view === "current" ? suggestion.aspect : aspectOf(image);
  const enhance = status?.enhance;
  const enhanceBlocked = enhance ? !enhance.available : false;
  const locked = busy !== null || aiRunning;

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <View style={[styles.frame, { aspectRatio: shownAspect }]}>
        {shownUrl ? (
          <Image source={{ uri: shownUrl }} style={StyleSheet.absoluteFill} contentFit="contain" transition={120} accessibilityLabel={image.caption?.trim() || "Bild der Immobilie"} />
        ) : (
          <Ionicons name="image-outline" size={32} color={colors.muted} />
        )}
      </View>

      <View style={styles.badges}>
        {image.is_cover ? <Badge label="Titelbild" tone="green" /> : null}
        {image.is_enhanced ? <Badge label="optimiert" tone="blue" /> : null}
        {image.is_ai_visualization ? <Badge label="KI-Visualisierung" tone="amber" /> : null}
        {image.is_floor_plan ? <Badge label="Grundriss" /> : null}
      </View>

      {notEditable ? (
        <>
          <Notice tone="info">{notEditable}</Notice>
          {image.source_image_id ? (
            <Button
              title="Zum Originalbild"
              variant="outline"
              onPress={() => router.push({ pathname: "/bild/[imageId]", params: { imageId: image.source_image_id! } })}
            />
          ) : null}
        </>
      ) : (
        <>
          {canCompare ? (
            <View style={{ gap: space.sm }}>
              <View style={{ flexDirection: "row", gap: space.sm }}>
                <Chip label="Original" selected={view === "original"} onPress={() => setView("original")} />
                <Chip label={suggestion ? "Vorschau" : "Optimiert"} selected={view === "current"} onPress={() => setView("current")} />
              </View>
              <Text style={text.small}>
                {suggestion
                  ? "Die Vorschau zeigt die automatische Optimierung. Sie ist noch nicht gespeichert."
                  : "Im Inserat wird die optimierte Version verwendet."}
              </Text>
            </View>
          ) : null}

          <View style={styles.card}>
            <SectionTitle>Automatische Optimierung</SectionTitle>
            <Text style={text.small}>
              Helligkeit, Kontrast, Farben und Weissabgleich werden mit klassischer Bildverarbeitung auf unseren Servern korrigiert – keine KI. Das
              Original bleibt immer erhalten.
            </Text>
            {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
            {suggestion ? (
              <>
                <Button title="Übernehmen" icon="checkmark" onPress={() => void accept()} loading={busy === "accept"} disabled={locked || enhanceBlocked} />
                <Button title="Vorschau verwerfen" variant="outline" onPress={() => setSuggestion(null)} disabled={locked} />
              </>
            ) : (
              <Button
                title="Automatisch optimieren"
                icon="color-wand-outline"
                variant={image.is_enhanced ? "outline" : "primary"}
                onPress={() => void suggest()}
                loading={busy === "suggest"}
                disabled={locked || enhanceBlocked}
              />
            )}
            {image.is_enhanced ? (
              <Button title="Original wiederherstellen" icon="refresh" variant="ghost" onPress={confirmRestore} loading={busy === "restore"} disabled={locked} />
            ) : null}
            <AvailabilityNotice availability={enhance} />
            <Button
              title="Einzelne Regler auf der Website"
              icon="open-outline"
              variant="ghost"
              onPress={() => void WebBrowser.openBrowserAsync(`${CONFIG.siteUrl}/dashboard/bilderstudio/${image.id}`)}
            />
          </View>

          <DesignPanel
            image={image}
            status={status}
            statusError={statusQuery.isError ? messageOf(statusQuery.error) : null}
            statusLoading={statusQuery.isPending}
            disabled={busy !== null}
            onRunningChange={setAiRunning}
            onFinished={refresh}
          />
        </>
      )}
    </ScrollView>
  );
}

function formatDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

function quotaText(quota: Quota): string {
  const day = formatDay(quota.resetsAt);
  return `Noch ${quota.remaining} von ${quota.limit} ${quota.unit} ${quota.period === "day" ? "heute" : "in diesem Monat"}${day ? ` · Zurücksetzung am ${day}` : ""}`;
}

/** Meldung des Servers, wenn eine Funktion nicht verfügbar ist, sonst der Stand des Kontingents. */
function AvailabilityNotice({ availability }: { availability: Availability | undefined }) {
  if (!availability) return null;
  if (!availability.available) {
    return <Notice tone={availability.reason === "quota_exceeded" ? "warning" : "info"}>{availability.message ?? "Diese Funktion ist im Moment nicht verfügbar."}</Notice>;
  }
  return availability.quota ? <Text style={text.small}>{quotaText(availability.quota)}</Text> : null;
}

// --- Designvorschlag mit KI ----------------------------------------------------

function DesignPanel({
  image,
  status,
  statusError,
  statusLoading,
  disabled,
  onRunningChange,
  onFinished,
}: {
  image: StudioImage;
  status: StudioStatus | undefined;
  statusError: string | null;
  statusLoading: boolean;
  disabled: boolean;
  onRunningChange: (running: boolean) => void;
  onFinished: () => void;
}) {
  const router = useRouter();
  const roomTypes = Object.entries(status?.roomTypes ?? {});
  const styleOptions = Object.entries(status?.styles ?? {});
  const [roomType, setRoomType] = React.useState<string | null>(null);
  const [style, setStyle] = React.useState<string | null>(null);
  const [progress, setProgress] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [consented, setConsented] = React.useState(false);
  const [consentFor, setConsentFor] = React.useState<DesignCapability | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => () => abortRef.current?.abort(), []);

  const selectedRoom = roomType ?? roomTypes[0]?.[0] ?? null;
  const selectedStyle = style ?? styleOptions[0]?.[0] ?? null;
  const running = progress !== null;

  async function run(capability: DesignCapability) {
    const controller = new AbortController();
    abortRef.current = controller;
    setError(null);
    setProgress("Auftrag wird gestartet …");
    onRunningChange(true);
    try {
      const jobId = await requestImageAi({
        imageId: image.id,
        capability,
        ...(capability === "virtual_staging" && selectedRoom && selectedStyle ? { roomType: selectedRoom, style: selectedStyle } : {}),
      });
      const job = await pollJob(jobId, { signal: controller.signal, onUpdate: (j) => setProgress(jobProgressText(j)) });
      if (job.status === "succeeded") {
        onFinished();
        const proposalId = (job.result as { imageId?: string } | null)?.imageId;
        if (proposalId) router.push({ pathname: "/bild/[imageId]", params: { imageId: proposalId } });
      } else if (job.consentRequired) {
        setConsentFor(capability);
      } else {
        setError(job.error ?? "Die Bild-KI konnte das Bild nicht bearbeiten.");
      }
    } catch (e) {
      if (isAbort(e)) return;
      if (e instanceof ApiError && e.consentRequired) setConsentFor(capability);
      else setError(messageOf(e));
    } finally {
      if (!controller.signal.aborted) {
        setProgress(null);
        onRunningChange(false);
      }
    }
  }

  function start(capability: DesignCapability) {
    // Vor der ersten Nutzung erklären, was an wen gesendet wird; der Server prüft die Einwilligung erneut
    if (status?.design.consentRequired && !consented) setConsentFor(capability);
    else void run(capability);
  }

  const usable = Boolean(status?.configured && status.design.available);
  const can = (capability: DesignCapability) => usable && Boolean(status?.capabilities.includes(capability));
  // Ohne Anbieter beide Vorschläge deaktiviert zeigen (erklärt), sonst was der Anbieter kann
  const shows = (capability: DesignCapability) => !status || !status.configured || status.capabilities.includes(capability);
  const locked = disabled || running;

  return (
    <View style={styles.card}>
      <SectionTitle>Designvorschlag mit KI</SectionTitle>
      <Text style={text.small}>
        Die Bild-KI erstellt aus diesem Foto einen Vorschlag desselben Raums. Wände, Fenster, Böden, Aussicht und allfällige Mängel bleiben
        unverändert. Der Vorschlag wird als neues Bild gespeichert und erst veröffentlicht, wenn Sie ihn geprüft haben – gekennzeichnet als
        «KI-Visualisierung».
      </Text>

      {statusLoading ? <ActivityIndicator color={colors.brand} /> : null}
      {statusError ? <Notice tone="error">{statusError}</Notice> : null}
      {status && !status.configured ? <Notice tone="info">{status.message}</Notice> : null}
      {status?.configured ? <AvailabilityNotice availability={status.design} /> : null}

      {shows("declutter") ? (
        <View style={styles.option}>
          <Text style={text.label}>Aufräumen</Text>
          <Text style={text.small}>Kleinkram, Kabel und Persönliches entfernen, Licht ausgleichen. Möbel, Raum und Ausstattung bleiben.</Text>
          <Button title="Aufräumen" icon="sparkles-outline" variant="outline" onPress={() => start("declutter")} disabled={!can("declutter") || locked} />
        </View>
      ) : null}

      {shows("virtual_staging") ? (
        <View style={styles.option}>
          <Text style={text.label}>Neu einrichten</Text>
          <Text style={text.small}>Möbel und Dekoration im gewählten Stil, auch für leere Räume. Raum und feste Ausstattung bleiben.</Text>
          {roomTypes.length > 0 ? (
            <>
              <Text style={[text.small, { color: colors.foreground, fontWeight: "600" }]}>Raum</Text>
              <View style={styles.chips}>
                {roomTypes.map(([value, label]) => (
                  <Chip key={value} label={label} selected={selectedRoom === value} onPress={() => setRoomType(value)} />
                ))}
              </View>
              <Text style={[text.small, { color: colors.foreground, fontWeight: "600" }]}>Stil</Text>
              <View style={styles.chips}>
                {styleOptions.map(([value, label]) => (
                  <Chip key={value} label={label} selected={selectedStyle === value} onPress={() => setStyle(value)} />
                ))}
              </View>
            </>
          ) : null}
          <Button title="Neu einrichten" icon="bed-outline" variant="outline" onPress={() => start("virtual_staging")} disabled={!can("virtual_staging") || locked} />
        </View>
      ) : null}

      {running ? (
        <View accessibilityRole="progressbar" accessibilityLabel="Die Bild-KI erstellt den Vorschlag" style={styles.progress}>
          <ActivityIndicator color={colors.brand} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[text.body, { fontSize: 15 }]}>Die Bild-KI erstellt den Vorschlag. Das dauert in der Regel unter einer Minute.</Text>
            <Text style={text.small}>{progress}</Text>
          </View>
        </View>
      ) : null}
      {error ? <Notice tone="error">{error}</Notice> : null}

      <AiConsentSheet
        visible={consentFor !== null}
        kind="image"
        imageInfo={status?.consent}
        onClose={() => setConsentFor(null)}
        onConsented={() => {
          const capability = consentFor;
          setConsented(true);
          setConsentFor(null);
          if (capability) void run(capability);
        }}
      />
    </View>
  );
}

// --- Vorschlag prüfen ----------------------------------------------------------

const CHECKS = [
  "Wände, Decke und Böden wie im Original",
  "Fenster, Türen und Aussicht unverändert",
  "Küche, Bad und Einbauten unverändert",
  "Keine Mängel verdeckt, z. B. Risse oder Flecken",
] as const;

/**
 * Prüfung eines Designvorschlags der Bild-KI. Erst mit «Freigeben» wird das Bild öffentlich
 * (gekennzeichnet als KI-Visualisierung); «Verwerfen» löscht es, das Original bleibt unverändert.
 */
function ReviewPanel({ detail }: { detail: StudioImageDetail }) {
  const { image, source } = detail;
  const router = useRouter();
  const queryClient = useQueryClient();
  const [view, setView] = React.useState<"before" | "after">("after");
  const [checked, setChecked] = React.useState(false);
  const [pending, setPending] = React.useState<"confirm" | "discard" | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const afterUrl = imageUrl(image, "lg");
  const beforeUrl = imageUrl(source, "lg");
  const showBefore = view === "before" && Boolean(beforeUrl);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["studio-images", image.property_id] });
    queryClient.invalidateQueries({ queryKey: ["studio-status"] });
    queryClient.invalidateQueries({ queryKey: ["workspace", image.property_id] });
    queryClient.invalidateQueries({ queryKey: ["my-properties"] });
  };
  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: "/bilderstudio/[propertyId]", params: { propertyId: image.property_id } });
  };

  async function confirm() {
    setPending("confirm");
    setError(null);
    try {
      await confirmProposal(image.id);
      refresh();
      queryClient.invalidateQueries({ queryKey: ["studio-image", image.id] });
      Alert.alert("Freigegeben", "Der Vorschlag ist freigegeben und erscheint im Inserat als KI-Visualisierung.");
      leave();
    } catch (e) {
      setError(messageOf(e));
      setPending(null);
    }
  }

  function discard() {
    Alert.alert("Vorschlag verwerfen?", "Das erzeugte Bild wird gelöscht. Ihr Originalfoto bleibt unverändert.", [
      { text: "Abbrechen", style: "cancel" },
      {
        text: "Verwerfen",
        style: "destructive",
        onPress: () => {
          setPending("discard");
          setError(null);
          discardProposal(image.id)
            .then(() => {
              refresh();
              leave();
            })
            .catch((e: unknown) => {
              setError(messageOf(e));
              setPending(null);
            });
        },
      },
    ]);
  }

  if (!afterUrl) {
    return (
      <View style={styles.page}>
        <Notice tone="info">Für diesen Vorschlag ist keine Bilddatei vorhanden.</Notice>
        <Button title="Verwerfen" variant="destructive" onPress={discard} loading={pending === "discard"} disabled={pending !== null} />
        {error ? <Notice tone="error">{error}</Notice> : null}
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={[text.body, { color: colors.muted }]}>
        Der Vorschlag ist noch nicht öffentlich. Vergleichen Sie ihn mit dem Original: Die KI kann Details verändern, etwa ein Fenster hinzufügen oder
        den Raum grösser wirken lassen.
      </Text>

      {beforeUrl ? (
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <Chip label="Vorher (Original)" selected={view === "before"} onPress={() => setView("before")} />
          <Chip label="Nachher (Vorschlag)" selected={view === "after"} onPress={() => setView("after")} />
        </View>
      ) : null}
      <View style={[styles.frame, { aspectRatio: aspectOf(showBefore ? source : image) }]}>
        <Image
          source={{ uri: showBefore ? beforeUrl! : afterUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          accessibilityLabel={showBefore ? "Originalfoto" : "Designvorschlag der Bild-KI"}
        />
        <View style={styles.frameBadge}>
          <Badge label={showBefore ? "Original" : "KI-Vorschlag"} tone="dark" />
        </View>
      </View>

      <View style={styles.card}>
        <SectionTitle>Darauf achten</SectionTitle>
        {CHECKS.map((item) => (
          <View key={item} style={{ flexDirection: "row", gap: space.sm, alignItems: "flex-start" }}>
            <Ionicons name="checkmark" size={18} color={colors.forest} style={{ marginTop: 2 }} />
            <Text style={[text.body, { flex: 1, fontSize: 15 }]}>{item}</Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <ToggleRow
          label="Ich habe den Vorschlag geprüft: Raum und feste Ausstattung entsprechen dem Originalfoto."
          value={checked}
          onValueChange={setChecked}
        />
      </View>

      {error ? <Notice tone="error">{error}</Notice> : null}
      <Button title="Freigeben" icon="checkmark-circle-outline" onPress={() => void confirm()} loading={pending === "confirm"} disabled={!checked || pending !== null} />
      <Button title="Verwerfen" variant="destructive" onPress={discard} loading={pending === "discard"} disabled={pending !== null} />
      <Text style={text.small}>
        Freigegeben erscheint der Vorschlag im Inserat und im Verkaufsdossier mit dem Hinweis «KI-Visualisierung». Ihr Originalfoto bleibt unverändert.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },
  frame: {
    width: "100%",
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: colors.mutedBg,
    alignItems: "center",
    justifyContent: "center",
  },
  frameBadge: { position: "absolute", top: space.sm, left: space.sm },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  card: { gap: space.md, padding: space.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  option: { gap: space.sm, padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  progress: { flexDirection: "row", gap: space.md, alignItems: "center", padding: space.md, borderRadius: radius.md, backgroundColor: colors.mutedBg },
});
