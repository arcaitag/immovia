import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Stack, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as React from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";

import { AvailabilityNotice, Card, JobProgressRow, toolErrorMessage, toolStyles } from "@/components/tools";
import { Badge, Button, EmptyState, Field, Loading, Notice, SectionTitle, ToggleRow } from "@/components/ui";
import {
  createDossier,
  deleteDossierVersion,
  dossierPdfUrl,
  dossierState,
  formatDateTimeFull,
  formatFileSize,
  setDossierPublic,
  setListingDossierPublic,
  type DossierOptions,
  type DossierSectionKey,
  type DossierState,
  type DossierTemplateId,
  type DossierVersion,
} from "@/lib/api-tools";
import { useAuth } from "@/lib/auth";
import { ApiError, useJob } from "@/lib/jobs";
import { colors, radius, space, text } from "@/lib/theme";

type Message = { tone: "success" | "error" | "warning"; text: string };

// Gleiche Regeln wie dossierContactSchema der Website
const PHONE = /^$|^\+?[0-9 ()/-]{6,24}$/;
const EMAIL = /^$|^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export default function DossierScreen() {
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();
  const { userId } = useAuth();
  const query = useQuery({
    queryKey: ["dossier", propertyId],
    queryFn: () => dossierState(propertyId),
    enabled: Boolean(userId),
    // Solange eine Version erstellt wird (z. B. in einer früheren Sitzung gestartet), Stand nachführen
    refetchInterval: (q) => (q.state.data?.versions.some((v) => v.status === "generating") ? 4000 : false),
  });

  let body: React.ReactNode;
  if (!userId) body = <EmptyState icon="lock-closed-outline" title="Bitte anmelden" description="Melden Sie sich an, um ein Verkaufsdossier zu erstellen." />;
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
    body = <Dossier propertyId={propertyId} state={query.data} />;
  }
  return (
    <>
      <Stack.Screen options={{ title: "Verkaufsdossier" }} />
      {body}
    </>
  );
}

function sortImages(images: DossierState["images"], order: string[]): string[] {
  const position = new Map(order.map((id, index) => [id, index]));
  return [...images]
    .sort((a, b) => (position.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (position.get(b.id) ?? Number.MAX_SAFE_INTEGER))
    .map((img) => img.id);
}

/**
 * Verkaufsdossier zusammenstellen (Vorlage, Abschnitte, Bilder, Titel, Einleitung, Kontakt), als
 * neue Version erstellen und Versionen verwalten (öffnen, für das Inserat freigeben, löschen).
 */
function Dossier({ propertyId, state }: { propertyId: string; state: DossierState }) {
  const queryClient = useQueryClient();
  const { initial, defaults, availability, images } = state;
  const [templateId, setTemplateId] = React.useState<DossierTemplateId>(initial?.templateId ?? state.templates[0]?.id ?? "modern");
  const [sections, setSections] = React.useState<Record<DossierSectionKey, boolean>>(
    () => Object.fromEntries(state.sections.map((s) => [s.key, initial?.sections[s.key] !== false])) as Record<DossierSectionKey, boolean>,
  );
  const [order, setOrder] = React.useState<string[]>(() => sortImages(images, initial?.imageOrder ?? []));
  const [excluded, setExcluded] = React.useState<string[]>(initial?.excludedImageIds ?? []);
  const [title, setTitle] = React.useState(initial?.title ?? "");
  const [intro, setIntro] = React.useState(initial?.intro ?? "");
  const [contact, setContact] = React.useState({
    name: initial?.contact?.name ?? "",
    company: initial?.contact?.company ?? "",
    phone: initial?.contact?.phone ?? "",
    email: initial?.contact?.email ?? "",
  });
  const [jobId, setJobId] = React.useState<string | null>(null);
  const [starting, setStarting] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<Message | null>(null);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["dossier", propertyId] });
    queryClient.invalidateQueries({ queryKey: ["workspace", propertyId] });
  };

  // Seit dem Laden hinzugekommene Fotos hinten anfügen, gelöschte weglassen
  const known = new Set(images.map((img) => img.id));
  const visibleOrder = [...order.filter((id) => known.has(id)), ...images.filter((img) => !order.includes(img.id)).map((img) => img.id)];
  const imageById = new Map(images.map((img) => [img.id, img]));
  const includedCount = visibleOrder.filter((id) => !excluded.includes(id)).length;

  const phoneError = PHONE.test(contact.phone.trim()) ? null : "Bitte geben Sie eine gültige Telefonnummer ein.";
  const emailError = EMAIL.test(contact.email.trim()) ? null : "Bitte geben Sie eine gültige E-Mail-Adresse ein.";
  const contactValid = !phoneError && !emailError;
  const overrideContact = Object.values(contact).some((value) => value.trim());

  const job = useJob(jobId, {
    onSuccess: (finished) => {
      const result = finished.result as { version?: number; skippedImages?: number } | null;
      setJobId(null);
      const done = result?.version ? `Version ${result.version} des Dossiers ist erstellt.` : "Das Dossier ist erstellt.";
      setMessage(
        result?.skippedImages
          ? { tone: "warning", text: `${done} ${result.skippedImages} Bild(er) konnten nicht geladen werden und fehlen im Dossier.` }
          : { tone: "success", text: done },
      );
      refresh();
    },
    onError: (failed) => {
      setJobId(null);
      setMessage({ tone: "error", text: failed.error ?? "Das Dossier konnte nicht erstellt werden." });
      refresh();
    },
  });

  async function create() {
    if (!contactValid) {
      setMessage({ tone: "error", text: "Bitte prüfen Sie die Kontaktangaben." });
      return;
    }
    const options: DossierOptions = {
      templateId,
      sections: Object.fromEntries(state.sections.filter((s) => !sections[s.key]).map((s) => [s.key, false])),
      excludedImageIds: visibleOrder.filter((id) => excluded.includes(id)),
      imageOrder: visibleOrder,
      title: title.trim() || undefined,
      intro: intro.trim() || undefined,
      contact: overrideContact
        ? { name: contact.name.trim(), company: contact.company.trim(), phone: contact.phone.trim(), email: contact.email.trim() }
        : undefined,
    };
    setStarting(true);
    setMessage(null);
    try {
      const res = await createDossier(propertyId, options);
      setJobId(res.jobId);
      refresh();
    } catch (error) {
      setMessage({ tone: "error", text: toolErrorMessage(error) });
    } finally {
      setStarting(false);
    }
  }

  function move(id: string, delta: -1 | 1) {
    const index = visibleOrder.indexOf(id);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= visibleOrder.length) return;
    const next = [...visibleOrder];
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next);
  }

  function toggleImage(id: string, include: boolean) {
    setExcluded((current) => (include ? current.filter((x) => x !== id) : current.includes(id) ? current : [...current, id]));
  }

  async function run(key: string, action: () => Promise<{ message?: string } | void>) {
    setBusy(key);
    setMessage(null);
    try {
      const res = await action();
      if (res && res.message) setMessage({ tone: "success", text: res.message });
      refresh();
    } catch (error) {
      setMessage({ tone: "error", text: toolErrorMessage(error) });
      refresh();
    } finally {
      setBusy(null);
    }
  }

  function openPdf(version: DossierVersion) {
    void run(`open-${version.id}`, async () => {
      const { url } = await dossierPdfUrl(version.id);
      await WebBrowser.openBrowserAsync(url);
    });
  }

  function confirmDelete(version: DossierVersion) {
    Alert.alert(
      `Version ${version.version} löschen?`,
      version.isPublic
        ? "Diese Version ist für das Inserat freigegeben. Nach dem Löschen bieten Sie kein Dossier mehr zum Download an, bis Sie eine andere Version freigeben."
        : "Die PDF-Datei wird endgültig gelöscht.",
      [
        { text: "Abbrechen", style: "cancel" },
        { text: "Löschen", style: "destructive", onPress: () => void run(`delete-${version.id}`, () => deleteDossierVersion(version.id)) },
      ],
    );
  }

  const hasReady = state.versions.some((v) => v.status === "ready");
  const { listing } = state;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
      <ScrollView contentContainerStyle={toolStyles.screen} keyboardShouldPersistTaps="handled">
        <View style={{ gap: space.xs }}>
          <Text style={text.title}>Verkaufsdossier erstellen</Text>
          <Text style={[text.body, { color: colors.muted }]}>
            Ein PDF mit Bildern, Eckdaten, Beschreibung und Kontakt – aus Ihren erfassten Angaben, ohne Ergänzungen. Wählen Sie eine Vorlage und prüfen Sie
            das erstellte PDF.
          </Text>
        </View>

        {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}

        <Card>
          <SectionTitle>Gespeicherte Versionen</SectionTitle>
          <Text style={text.small}>Jede Erstellung ist eine eigene Version. Interessenten erhalten nur die freigegebene Version.</Text>

          <View style={[toolStyles.box, { flexDirection: "row", alignItems: "center", gap: space.md }]}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={text.label}>Dossier im Inserat zum Download anbieten</Text>
              <Text style={text.small}>
                {!listing.exists
                  ? "Es gibt noch kein Inserat."
                  : !hasReady
                    ? "Erstellen Sie zuerst eine Version."
                    : listing.isPublished
                      ? "Interessenten können die freigegebene Version auf der Inseratseite herunterladen."
                      : "Sichtbar, sobald das Inserat veröffentlicht ist."}
              </Text>
            </View>
            <Switch
              accessibilityLabel="Dossier im Inserat zum Download anbieten"
              value={listing.dossierPublic}
              disabled={!listing.exists || (!hasReady && !listing.dossierPublic) || busy !== null}
              onValueChange={(value) => void run("listing", () => setListingDossierPublic(propertyId, value))}
              trackColor={{ true: colors.brand, false: colors.input }}
            />
          </View>

          {state.versions.length === 0 ? <Text style={[text.small, { textAlign: "center", paddingVertical: space.md }]}>Noch keine Version erstellt.</Text> : null}
          {state.versions.map((v) => (
            <View key={v.id} style={[toolStyles.listItem, { gap: space.sm, paddingVertical: space.md }, v.isPublic && { borderColor: colors.brand }]}>
              <View style={toolStyles.wrap}>
                <Text style={text.label}>Version {v.version}</Text>
                {v.status === "generating" ? <Badge tone="blue" label="Wird erstellt" /> : v.status === "failed" ? <Badge tone="amber" label="Fehlgeschlagen" /> : null}
                {v.isPublic ? <Badge tone="green" label="Für das Inserat freigegeben" /> : null}
              </View>
              <Text style={text.small}>
                {formatDateTimeFull(v.createdAt)} · Vorlage {v.templateLabel}
                {v.pageCount ? ` · ${v.pageCount} Seiten` : ""}
                {v.fileSize ? ` · ${formatFileSize(v.fileSize)}` : ""}
              </Text>
              {v.status === "failed" && v.error ? <Text style={[text.small, { color: colors.destructive }]}>{v.error}</Text> : null}
              {v.status === "ready" ? (
                <>
                  <Button title="PDF öffnen" variant="outline" icon="document-outline" onPress={() => openPdf(v)} loading={busy === `open-${v.id}`} disabled={busy !== null} />
                  <Button
                    title={v.isPublic ? "Freigabe aufheben" : "Für Inserat freigeben"}
                    variant={v.isPublic ? "ghost" : "outline"}
                    icon={v.isPublic ? "eye-off-outline" : "globe-outline"}
                    onPress={() => void run(`public-${v.id}`, () => setDossierPublic(v.id, !v.isPublic))}
                    loading={busy === `public-${v.id}`}
                    disabled={busy !== null}
                  />
                </>
              ) : null}
              {v.status !== "generating" ? (
                <Button
                  title={`Version ${v.version} löschen`}
                  variant="destructive"
                  icon="trash-outline"
                  onPress={() => confirmDelete(v)}
                  loading={busy === `delete-${v.id}`}
                  disabled={busy !== null}
                />
              ) : null}
            </View>
          ))}
        </Card>

        <Card>
          <SectionTitle>Vorlage</SectionTitle>
          <View accessibilityRole="radiogroup" accessibilityLabel="Vorlage" style={{ gap: space.sm }}>
            {state.templates.map((template) => {
              const selected = template.id === templateId;
              return (
                <Pressable
                  key={template.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => setTemplateId(template.id)}
                  style={[toolStyles.listItem, selected && toolStyles.listItemActive]}
                >
                  <Text style={text.label}>{template.label}</Text>
                  <Text style={text.small}>{template.description}</Text>
                </Pressable>
              );
            })}
          </View>
        </Card>

        <Card>
          <SectionTitle>Inhalte</SectionTitle>
          {state.sections.map((section) => {
            const disabled = section.key === "qrCode" && !defaults.isPublished;
            return disabled ? (
              <View key={section.key} style={{ gap: 2, minHeight: 48, justifyContent: "center", opacity: 0.6 }}>
                <Text style={text.body}>{section.label}</Text>
                <Text style={text.small}>Erst verfügbar, wenn das Inserat veröffentlicht ist.</Text>
              </View>
            ) : (
              <ToggleRow
                key={section.key}
                label={section.label}
                hint={section.description}
                value={sections[section.key]}
                onValueChange={(value) => setSections((current) => ({ ...current, [section.key]: value }))}
              />
            );
          })}
          <Text style={text.small}>Abschnitte ohne erfasste Angaben erscheinen nicht im Dossier – es wird nichts ergänzt.</Text>
        </Card>

        <Card>
          <SectionTitle>Titel und Einleitung</SectionTitle>
          <Field
            label="Titel"
            value={title}
            onChangeText={setTitle}
            maxLength={140}
            placeholder={defaults.title || undefined}
            hint={defaults.title ? `Leer lassen für den Inseratetitel: «${defaults.title}»` : "Leer lassen für einen Titel aus Objektart und Ort."}
          />
          <Field
            label="Einleitung"
            value={intro}
            onChangeText={setIntro}
            maxLength={1200}
            multiline
            placeholder={defaults.intro || undefined}
            hint="Leer lassen für die Kurzbeschreibung aus dem Inserat."
          />
        </Card>

        <Card>
          <SectionTitle>
            Bilder ({includedCount} von {visibleOrder.length})
          </SectionTitle>
          {visibleOrder.length === 0 ? <Text style={text.small}>Noch keine Bilder vorhanden. Das Dossier wird ohne Fotos erstellt.</Text> : null}
          {visibleOrder.map((id, index) => {
            const image = imageById.get(id);
            if (!image) return null;
            const included = !excluded.includes(id);
            const name = image.caption?.trim() || `Bild ${index + 1}`;
            return (
              <View key={id} style={[styles.imageRow, !included && { opacity: 0.6 }]}>
                <View style={styles.thumb}>
                  {image.url ? <Image source={image.url} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Ionicons name="image-outline" size={22} color={colors.muted} />}
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={text.label} numberOfLines={1}>
                    {name}
                  </Text>
                  <View style={[toolStyles.wrap, { gap: 4 }]}>
                    {image.isCover ? <Badge tone="green" label="Titelbild" /> : null}
                    {image.isFloorPlan ? <Badge tone="blue" label="Grundriss" /> : null}
                    {image.isAiVisualization ? <Badge tone="amber" label="KI-Visualisierung" /> : null}
                  </View>
                  <View style={toolStyles.row}>
                    <IconButton icon="arrow-up" label={`${name} nach oben verschieben`} disabled={index === 0} onPress={() => move(id, -1)} />
                    <IconButton icon="arrow-down" label={`${name} nach unten verschieben`} disabled={index === visibleOrder.length - 1} onPress={() => move(id, 1)} />
                  </View>
                </View>
                <Switch
                  accessibilityLabel={`${name} im Dossier verwenden`}
                  value={included}
                  onValueChange={(value) => toggleImage(id, value)}
                  trackColor={{ true: colors.brand, false: colors.input }}
                />
              </View>
            );
          })}
          <Text style={text.small}>
            Das erste Foto (bzw. das Titelbild) erscheint auf dem Deckblatt. KI-Visualisierungen sind im Dossier sichtbar gekennzeichnet.
          </Text>
        </Card>

        <Card>
          <SectionTitle>Ansprechpartner</SectionTitle>
          <Text style={text.small}>
            Leer lassen für den Kontakt aus dem Inserat
            {defaults.contactName
              ? ` (${[defaults.contactName, defaults.showsPhone ? defaults.contactPhone : null, defaults.contactEmail].filter(Boolean).join(", ")})`
              : ""}
            .
          </Text>
          <Field label="Name" value={contact.name} onChangeText={(name) => setContact((c) => ({ ...c, name }))} maxLength={120} autoCapitalize="words" />
          <Field label="Firma (optional)" value={contact.company} onChangeText={(company) => setContact((c) => ({ ...c, company }))} maxLength={120} />
          <Field label="Telefon" value={contact.phone} onChangeText={(phone) => setContact((c) => ({ ...c, phone }))} maxLength={30} keyboardType="phone-pad" error={phoneError} />
          <Field
            label="E-Mail"
            value={contact.email}
            onChangeText={(email) => setContact((c) => ({ ...c, email }))}
            maxLength={200}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            error={emailError}
          />
        </Card>

        <Card>
          <Text style={text.small}>
            Speichert eine neue Version als PDF. Frühere Versionen bleiben erhalten. Eine Vorschau vor dem Erstellen gibt es nur auf der Website – in der App
            öffnen Sie die fertige Version unter «Gespeicherte Versionen».
          </Text>
          <AvailabilityNotice availability={availability} />
          <JobProgressRow job={job.job} running={job.running} label="Das Dossier wird erstellt (Bilder werden in Druckqualität eingebettet)" />
          {job.error ? <Notice tone="error">{toolErrorMessage(job.error)}</Notice> : null}
          <Button
            title="Dossier erstellen"
            icon="document-text-outline"
            onPress={() => void create()}
            loading={starting || job.running}
            disabled={!availability.available || !contactValid}
          />
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function IconButton({ icon, label, disabled, onPress }: { icon: React.ComponentProps<typeof Ionicons>["name"]; label: string; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, pressed && { backgroundColor: colors.mint100 }, disabled && { opacity: 0.35 }]}
    >
      <Ionicons name={icon} size={19} color={colors.forest} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  imageRow: { flexDirection: "row", alignItems: "center", gap: space.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: space.sm },
  thumb: { width: 64, height: 64, borderRadius: radius.sm, overflow: "hidden", backgroundColor: colors.mutedBg, alignItems: "center", justifyContent: "center" },
  iconButton: { width: 44, height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
});
