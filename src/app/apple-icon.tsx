import { ImageResponse } from "next/og";

/** Symbol für den Home-Bildschirm von iOS (180 × 180, ohne Transparenz). */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const BRAND = "#5A8A30";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
        }}
      >
        <svg width="124" height="124" viewBox="0 0 40 40" fill="none">
          <path
            d="M6.5 18.2 20 6.5l13.5 11.7V31a2.5 2.5 0 0 1-2.5 2.5H9A2.5 2.5 0 0 1 6.5 31V18.2Z"
            stroke={BRAND}
            strokeWidth="3.2"
            strokeLinejoin="round"
          />
          <path d="M15.5 33.5v-8.2a4.5 4.5 0 0 1 9 0v8.2" stroke={BRAND} strokeWidth="3.2" strokeLinejoin="round" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
