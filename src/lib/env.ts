/**
 * Zentrale Konfiguration aus Umgebungsvariablen.
 * Öffentliche Werte (NEXT_PUBLIC_*) dürfen im Browser landen, alles andere nur serverseitig.
 */

function readPublic(name: "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" | "NEXT_PUBLIC_SITE_URL") {
  // Next.js ersetzt nur statische Zugriffe auf process.env.NEXT_PUBLIC_* im Client-Bundle
  switch (name) {
    case "NEXT_PUBLIC_SUPABASE_URL":
      return process.env.NEXT_PUBLIC_SUPABASE_URL;
    case "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY":
      return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    case "NEXT_PUBLIC_SITE_URL":
      return process.env.NEXT_PUBLIC_SITE_URL;
  }
}

export const publicEnv = {
  get supabaseUrl(): string {
    return readPublic("NEXT_PUBLIC_SUPABASE_URL") ?? "";
  },
  get supabasePublishableKey(): string {
    return readPublic("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") ?? "";
  },
  get siteUrl(): string {
    const explicit = readPublic("NEXT_PUBLIC_SITE_URL");
    if (explicit) return explicit.replace(/\/$/, "");
    if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
    if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
    return "http://localhost:3000";
  },
};

export function isSupabaseConfigured(): boolean {
  return Boolean(publicEnv.supabaseUrl && publicEnv.supabasePublishableKey);
}

/** Nur serverseitig verwenden. */
export const serverEnv = {
  get supabaseSecretKey(): string | undefined {
    return process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? undefined;
  },
  get anthropicApiKey(): string | undefined {
    return process.env.ANTHROPIC_API_KEY || undefined;
  },
  get anthropicModel(): string | undefined {
    return process.env.ANTHROPIC_MODEL || undefined;
  },
  get imageAiProvider(): string | undefined {
    return process.env.IMAGE_AI_PROVIDER || undefined;
  },
  get resendApiKey(): string | undefined {
    return process.env.RESEND_API_KEY || undefined;
  },
  get emailFrom(): string {
    return process.env.EMAIL_FROM || "Immovia <noreply@immovia.ch>";
  },
  get emailReplyTo(): string | undefined {
    return process.env.EMAIL_REPLY_TO || undefined;
  },
  get cronSecret(): string | undefined {
    return process.env.CRON_SECRET || undefined;
  },
  get analyticsSalt(): string {
    return process.env.ANALYTICS_SALT || process.env.SUPABASE_SECRET_KEY || "immovia-local-salt";
  },
};

export interface ServiceStatus {
  key: "supabase" | "service_role" | "ai_text" | "image_ai" | "email" | "cron";
  label: string;
  configured: boolean;
  hint: string;
}

export function getServiceStatus(): ServiceStatus[] {
  return [
    {
      key: "supabase",
      label: "Datenbank (Supabase)",
      configured: isSupabaseConfigured(),
      hint: "NEXT_PUBLIC_SUPABASE_URL und NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY setzen.",
    },
    {
      key: "service_role",
      label: "Server-Schlüssel (Service Role)",
      configured: Boolean(serverEnv.supabaseSecretKey),
      hint: "SUPABASE_SECRET_KEY setzen (Bewertungen, KI-Jobs, E-Mails, Statistik).",
    },
    {
      key: "ai_text",
      label: "KI-Texte (Anthropic)",
      configured: Boolean(serverEnv.anthropicApiKey),
      hint: "ANTHROPIC_API_KEY setzen.",
    },
    {
      key: "image_ai",
      label: "Bild-KI (Perspektive, Möblierung)",
      configured: Boolean(serverEnv.imageAiProvider),
      hint: "Noch kein Anbieter angebunden. Grundkorrekturen funktionieren ohne Bild-KI.",
    },
    {
      key: "email",
      label: "E-Mail-Versand (Resend)",
      configured: Boolean(serverEnv.resendApiKey),
      hint: "RESEND_API_KEY und EMAIL_FROM setzen, Domain bei Resend verifizieren.",
    },
    {
      key: "cron",
      label: "Hintergrundaufträge (Cron)",
      configured: Boolean(serverEnv.cronSecret),
      hint: "CRON_SECRET setzen; Vercel Cron ruft /api/cron/process auf.",
    },
  ];
}
