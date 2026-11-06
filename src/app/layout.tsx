import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { AppProviders } from "@/components/providers/app-providers";
import { ServiceWorkerRegistration } from "@/components/providers/service-worker";
import { publicEnv } from "@/lib/env";
import { SITE } from "@/lib/constants";
import "./globals.css";

const inter = localFont({
  src: "../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
  variable: "--font-inter",
  weight: "100 900",
  display: "swap",
});

const manrope = localFont({
  src: "../../node_modules/@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2",
  variable: "--font-manrope",
  weight: "200 800",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.siteUrl),
  title: {
    default: "Immovia – Immobilie bewerten, professionell verkaufen",
    template: "%s · Immovia",
  },
  description: SITE.description,
  applicationName: "Immovia",
  openGraph: {
    type: "website",
    locale: "de_CH",
    siteName: "Immovia",
    title: "Immovia – Immobilie bewerten, professionell verkaufen",
    description: SITE.description,
  },
  twitter: { card: "summary_large_image" },
  formatDetection: { telephone: false },
  appleWebApp: { capable: true, title: "Immovia", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de-CH" className={`${inter.variable} ${manrope.variable}`}>
      <body className="min-h-dvh">
        <a
          href="#inhalt"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-forest focus:px-4 focus:py-2 focus:text-white"
        >
          Zum Inhalt springen
        </a>
        <AppProviders>{children}</AppProviders>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
