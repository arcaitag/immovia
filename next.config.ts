import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=(self), payment=(), usb=(), interest-cohort=()",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    // Eigener Loader: Varianten werden beim Upload mit sharp erzeugt (keine Kosten für On-Demand-Optimierung)
    loader: "custom",
    loaderFile: "./src/lib/images/loader.ts",
    qualities: [60, 75, 85],
    // Grösste Stufe 2560 statt 3840: Vollbreite-Bilder (Hero) auf 1440er-Retina-Displays rund halb so gross
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2560],
  },
  serverExternalPackages: ["sharp", "@react-pdf/renderer"],
  // Schriften für PDF-Dossiers und Bewertungsberichte (werden zur Laufzeit von der Platte gelesen)
  outputFileTracingIncludes: {
    "/**": ["./src/lib/pdf/fonts/**"],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/(dashboard|admin)(.*)",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
