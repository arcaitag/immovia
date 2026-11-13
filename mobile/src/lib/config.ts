/**
 * Öffentliche Konfiguration der App. URL und Publishable Key von Supabase sind öffentlich
 * (dieselben Werte stecken in jeder Seite der Website); der Zugriff ist über Row Level Security
 * geschützt. Private Schlüssel gehören nie in die App.
 * Überschreibbar über EXPO_PUBLIC_* in einer .env-Datei (z. B. für eine Testumgebung).
 */
export const CONFIG = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "https://wlvhzhphpyvlqkafskwf.supabase.co",
  supabaseKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_bNUBA4VMUPFoKkMnjIBSqw_uiiE4C8n",
  siteUrl: (process.env.EXPO_PUBLIC_SITE_URL ?? "https://immovia-olive.vercel.app").replace(/\/$/, ""),
} as const;
