import type { MetadataRoute } from "next";
import { SITE } from "@/lib/constants";

/** Web-App-Manifest (PWA): Immovia lässt sich zum Home-Bildschirm hinzufügen. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: SITE.name,
    short_name: SITE.name,
    description: SITE.description,
    lang: "de-CH",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    categories: ["business", "lifestyle", "productivity"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png", purpose: "any" },
    ],
    shortcuts: [
      { name: "Immobilien suchen", url: "/immobilien" },
      { name: "Merkliste", url: "/dashboard/merkliste" },
      { name: "Nachrichten", url: "/dashboard/nachrichten" },
    ],
  };
}
