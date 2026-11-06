import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getAppointmentForIcs } from "@/services/viewings";
import { buildIcsEvent, icsFileName, type IcsStatus } from "@/lib/ics";
import { publicEnv } from "@/lib/env";
import { zurichDateKey } from "@/lib/viewings/calendar";
import { isUuid } from "@/lib/utils";
import type { AppointmentStatus } from "@/lib/constants";

const STATUS: Record<AppointmentStatus, IcsStatus> = {
  requested: "TENTATIVE",
  reschedule_requested: "TENTATIVE",
  confirmed: "CONFIRMED",
  completed: "CONFIRMED",
  no_show: "CONFIRMED",
  cancelled: "CANCELLED",
};

/** Kalenderdatei (ICS) zu einem Besichtigungstermin – nur für Gast oder Verkäuferseite. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ appointmentId: string }> }) {
  const { appointmentId } = await params;
  const notFound = () => new NextResponse("Nicht gefunden", { status: 404, headers: { "Cache-Control": "no-store" } });
  if (!isUuid(appointmentId)) return notFound();
  const user = await getSessionUser();
  if (!user) return new NextResponse("Bitte melden Sie sich an.", { status: 401, headers: { "Cache-Control": "no-store" } });

  const appointment = await getAppointmentForIcs(appointmentId);
  if (!appointment) return notFound();

  const siteUrl = publicEnv.siteUrl;
  let host = "immovia.ch";
  try {
    host = new URL(siteUrl).hostname || host;
  } catch {
    // Standardwert behalten
  }
  const start = new Date(appointment.startsAt);
  const ics = buildIcsEvent({
    uid: `${appointment.id}@${host}`,
    start,
    end: new Date(appointment.endsAt),
    summary: `Besichtigung: ${appointment.title}`,
    location: appointment.address,
    url: appointment.slug ? `${siteUrl}/immobilien/${appointment.slug}` : `${siteUrl}/dashboard/besichtigungen`,
    description: `Termin über Immovia. Details und Nachrichten: ${siteUrl}/dashboard/besichtigungen`,
    status: STATUS[appointment.status],
    stamp: new Date(),
    lastModified: new Date(appointment.updatedAt),
    alarmMinutesBefore: 60,
  });

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${icsFileName(start, zurichDateKey(start))}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
