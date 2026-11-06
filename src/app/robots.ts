import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo/site";

/** Private Bereiche, Schnittstellen und Anmeldeseiten werden nicht indexiert. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/dashboard",
          "/admin",
          "/api",
          "/auth",
          "/login",
          "/registrieren",
          "/passwort-vergessen",
          "/passwort-zuruecksetzen",
          "/einladung",
          "/verkaufen/start",
        ],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
