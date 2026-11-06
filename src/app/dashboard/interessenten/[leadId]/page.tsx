import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarCheck, FileText, Lock, MessageSquare, Phone } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Avatar } from "@/components/ui/avatar";
import { LeadStatusSelect } from "@/components/leads/lead-status-select";
import { LeadRating } from "@/components/leads/lead-rating";
import { LeadNotes } from "@/components/leads/lead-notes";
import { LeadDocuments } from "@/components/leads/lead-documents";
import { requireUser } from "@/lib/auth/session";
import { APPOINTMENT_STATUS, LISTING_STATUS } from "@/lib/constants";
import { formatDate, formatDateTime, formatPhone, formatRelative, formatTimeRange } from "@/lib/format";
import { isUuid } from "@/lib/utils";
import { getLeadDetail } from "@/services/leads";
import { getDocumentsForGrantee } from "@/services/documents";

export const metadata: Metadata = { title: "Interessent" };

const SOURCE_LABELS: Record<string, string> = { inquiry: "Kontaktanfrage", viewing: "Besichtigungsbuchung", manual: "Manuell erfasst" };

export default async function LeadDetailPage({ params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;
  if (!isUuid(leadId)) notFound();
  const user = await requireUser(`/dashboard/interessenten/${leadId}`);
  // RLS: Leads sind nur für Eigentümer bzw. Team lesbar – Interessenten sehen sie nie
  const lead = await getLeadDetail(leadId, user.id);
  if (!lead) notFound();

  const documents =
    lead.listing && lead.interested ? await getDocumentsForGrantee(lead.listing.propertyId, lead.interested.id) : { shared: [], available: [] };
  const name = lead.interested?.name ?? "Gelöschtes Konto";
  const listingHref =
    lead.listing?.slug && (lead.listing.status === "published" || lead.listing.status === "reserved") ? `/immobilien/${lead.listing.slug}` : null;

  return (
    <div className="flex flex-col gap-6">
      <Link href="/dashboard/interessenten" className="inline-flex items-center gap-1.5 self-start text-sm font-semibold text-primary hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> Alle Interessenten
      </Link>

      <PageHeader
        eyebrow={
          lead.listing ? (
            listingHref ? (
              <Link href={listingHref} className="hover:underline">
                {lead.listing.title}
              </Link>
            ) : (
              <span>
                {lead.listing.title} · {LISTING_STATUS[lead.listing.status].label}
              </span>
            )
          ) : (
            "Inserat entfernt"
          )
        }
        title={
          <span className="flex items-center gap-3">
            <Avatar src={lead.interested?.avatarUrl} name={name} className="size-11 text-sm" />
            <span className="min-w-0 truncate">{name}</span>
          </span>
        }
        description={
          <span suppressHydrationWarning>
            {SOURCE_LABELS[lead.source] ?? "Kontakt"} am {formatDate(lead.createdAt)} · letzte Aktivität {formatRelative(lead.lastActivityAt)}
          </span>
        }
        actions={
          <>
            {lead.conversation ? (
              <Button asChild>
                <Link href={`/dashboard/nachrichten/${lead.conversation.id}`}>
                  <MessageSquare aria-hidden /> Nachricht schreiben
                </Link>
              </Button>
            ) : null}
            {lead.listing ? (
              <Button asChild variant="outline">
                <Link href={`/dashboard/besichtigungen?inserat=${lead.listing.id}`}>
                  <CalendarCheck aria-hidden /> Besichtigungen
                </Link>
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Anfrage</CardTitle>
              <CardDescription>Was die Person Ihnen beim ersten Kontakt geschrieben hat.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {lead.inquiries.length === 0 ? (
                <p className="text-sm text-muted-foreground">Kein Anfragetext erfasst. Der Kontakt entstand über eine Besichtigungsbuchung.</p>
              ) : (
                lead.inquiries.map((inquiry) => (
                  <div key={inquiry.id} className="grid gap-3 rounded-xl border border-border bg-surface p-4">
                    <p className="whitespace-pre-wrap break-words text-[0.9375rem] leading-relaxed">{inquiry.message}</p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatDateTime(inquiry.createdAt)}</span>
                      {inquiry.wantsViewing ? <Badge tone="green">Wünscht Besichtigung</Badge> : null}
                      {inquiry.wantsDossier ? <Badge tone="blue">Wünscht Dossier</Badge> : null}
                      {inquiry.phone ? (
                        <a href={`tel:${inquiry.phone.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-1 font-semibold text-forest hover:underline">
                          <Phone className="size-3.5" aria-hidden /> {formatPhone(inquiry.phone)}
                        </a>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
              {lead.conversation?.lastMessagePreview ? (
                <div className="flex items-start gap-3 border-t border-border pt-4">
                  <MessageSquare className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="text-muted-foreground" suppressHydrationWarning>
                      Letzte Nachricht {formatRelative(lead.conversation.lastMessageAt)}
                    </p>
                    <p className="truncate">{lead.conversation.lastMessagePreview}</p>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Besichtigungen</CardTitle>
              <CardDescription>Termine dieser Person zu diesem Inserat.</CardDescription>
            </CardHeader>
            <CardContent>
              {lead.appointments.length === 0 ? (
                <p className="text-sm text-muted-foreground">Noch keine Besichtigung vereinbart.</p>
              ) : (
                <ul className="divide-y divide-border rounded-xl border border-border">
                  {lead.appointments.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center gap-3 p-3">
                      <CalendarCheck className="size-5 text-forest" aria-hidden />
                      <span className="min-w-0 flex-1 text-sm font-medium tabular">{formatTimeRange(a.startsAt, a.endsAt)}</span>
                      <StatusBadge label={APPOINTMENT_STATUS[a.status].label} tone={APPOINTMENT_STATUS[a.status].tone} />
                      {a.cancelReason ? <p className="w-full text-xs text-muted-foreground">Grund: {a.cancelReason}</p> : null}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {lead.listing && lead.interested ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="size-5 text-forest" aria-hidden /> Dokumente
                </CardTitle>
                <CardDescription>Unterlagen gezielt freigeben, auf Wunsch befristet und jederzeit widerrufbar.</CardDescription>
              </CardHeader>
              <CardContent>
                <LeadDocuments
                  propertyId={lead.listing.propertyId}
                  person={{ userId: lead.interested.id, name }}
                  shared={documents.shared.map((s) => ({
                    grantId: s.grant.id,
                    documentId: s.document.id,
                    title: s.document.title,
                    category: s.document.category,
                    sizeBytes: s.document.sizeBytes,
                    sharedAt: s.grant.createdAt,
                    expiresAt: s.grant.expiresAt,
                    isExpired: s.grant.isExpired,
                  }))}
                  available={documents.available.map((d) => ({ id: d.id, title: d.title, category: d.category }))}
                />
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Status und Bewertung</CardTitle>
              <CardDescription>Nur für Sie sichtbar.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                <label htmlFor="lead-status" className="text-sm font-semibold">
                  Status
                </label>
                <LeadStatusSelect key={lead.id} id="lead-status" leadId={lead.id} value={lead.status} className="w-full sm:w-full" />
              </div>
              <div className="grid gap-1">
                <p className="text-sm font-semibold">Bewertung</p>
                <LeadRating key={lead.id} leadId={lead.id} value={lead.rating} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="size-5 text-forest" aria-hidden /> Private Notizen
              </CardTitle>
              <CardDescription>Interessenten sehen diese Notizen nie.</CardDescription>
            </CardHeader>
            <CardContent>
              <LeadNotes key={lead.id} leadId={lead.id} initialNotes={lead.notes} teamVisible={lead.isTeamLead} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
