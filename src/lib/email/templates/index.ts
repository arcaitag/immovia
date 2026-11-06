import { accountChangeTemplate, orgInvitationTemplate, welcomeTemplate } from "@/lib/email/templates/account";
import {
  dossierReadyTemplate,
  listingModeratedTemplate,
  listingPublishedTemplate,
  searchAlertDigestTemplate,
  searchAlertTemplate,
} from "@/lib/email/templates/listings";
import { documentSharedTemplate, newInquiryTemplate, newMessageTemplate } from "@/lib/email/templates/messages";
import {
  viewingCancelledTemplate,
  viewingConfirmedTemplate,
  viewingReminderTemplate,
  viewingRequestedTemplate,
  viewingRescheduledTemplate,
  viewingRescheduleTemplate,
} from "@/lib/email/templates/viewings";
import { createTemplateContext, type EmailTemplateDefinition } from "@/lib/email/templates/shared";
import { renderEmailContent, type EmailRenderContext, type RenderedEmail } from "@/lib/email/layout";

/**
 * Zentrale Verwaltung aller E-Mail-Vorlagen. Die Schlüssel entsprechen
 * email_outbox.template (von Datenbankfunktionen und queueEmail() geschrieben).
 */
export const EMAIL_TEMPLATES = {
  welcome: welcomeTemplate,
  account_change: accountChangeTemplate,
  org_invitation: orgInvitationTemplate,
  listing_published: listingPublishedTemplate,
  listing_moderated: listingModeratedTemplate,
  dossier_ready: dossierReadyTemplate,
  search_alert: searchAlertTemplate,
  search_alert_digest: searchAlertDigestTemplate,
  new_inquiry: newInquiryTemplate,
  new_message: newMessageTemplate,
  document_shared: documentSharedTemplate,
  viewing_requested: viewingRequestedTemplate,
  viewing_confirmed: viewingConfirmedTemplate,
  viewing_cancelled: viewingCancelledTemplate,
  viewing_reschedule: viewingRescheduleTemplate,
  viewing_rescheduled: viewingRescheduledTemplate,
  viewing_reminder: viewingReminderTemplate,
} satisfies Record<string, EmailTemplateDefinition>;

export type EmailTemplateKey = keyof typeof EMAIL_TEMPLATES;
export const EMAIL_TEMPLATE_KEYS = Object.keys(EMAIL_TEMPLATES) as EmailTemplateKey[];

export function isEmailTemplateKey(value: unknown): value is EmailTemplateKey {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(EMAIL_TEMPLATES, value);
}

/** Fehler in Vorlage oder Nutzdaten: Wiederholen hilft nicht. */
export class EmailTemplateError extends Error {
  readonly fields: string[];
  constructor(message: string, fields: string[] = []) {
    super(message);
    this.name = "EmailTemplateError";
    this.fields = fields;
  }
}

/** Rendert eine Vorlage. Wirft EmailTemplateError bei unbekannter Vorlage oder fehlenden Pflichtfeldern. */
export function renderEmail(template: string, payload: unknown, ctx: EmailRenderContext): RenderedEmail {
  if (!isEmailTemplateKey(template)) {
    throw new EmailTemplateError(`Unbekannte E-Mail-Vorlage: ${template}`);
  }
  const definition: EmailTemplateDefinition = EMAIL_TEMPLATES[template];
  const parsed = definition.schema.safeParse(payload ?? {});
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((issue) => issue.path.join(".") || "(payload)"))];
    throw new EmailTemplateError(`Ungültige oder fehlende Daten für «${template}»: ${fields.join(", ")}`, fields);
  }
  const templateContext = createTemplateContext(ctx);
  const content = definition.build(parsed.data, templateContext);
  const rendered = renderEmailContent(content, templateContext);
  return content.attachments?.length ? { ...rendered, attachments: content.attachments } : rendered;
}
