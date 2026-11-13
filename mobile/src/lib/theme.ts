/** Farben und Masse gemäss Immovia-Gestaltung (wie src/app/globals.css der Website). */
export const colors = {
  background: "#ffffff",
  surface: "#f8faf6",
  foreground: "#192820",
  muted: "#69736d",
  mutedBg: "#f3f6f1",
  border: "#e4eae1",
  input: "#d9e1d5",
  brand: "#4a8f26",
  primary: "#3d7e1f",
  primaryPressed: "#346c1a",
  forest: "#274b32",
  mint100: "#eaf3df",
  mint200: "#d8ebc6",
  destructive: "#b42318",
  destructiveBg: "#fef3f2",
  warning: "#9a4b06",
  warningBg: "#fef6e7",
  info: "#1f5f8b",
  infoBg: "#edf5fb",
  white: "#ffffff",
} as const;

export const radius = { sm: 8, md: 12, lg: 16, xl: 22, full: 999 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const text = {
  title: { fontSize: 26, fontWeight: "800" as const, letterSpacing: -0.5, color: colors.foreground },
  heading: { fontSize: 19, fontWeight: "700" as const, letterSpacing: -0.3, color: colors.foreground },
  body: { fontSize: 16, lineHeight: 23, color: colors.foreground },
  small: { fontSize: 13.5, lineHeight: 19, color: colors.muted },
  label: { fontSize: 14, fontWeight: "600" as const, color: colors.foreground },
};
