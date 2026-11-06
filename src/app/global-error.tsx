"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="de-CH">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "4rem 1.5rem", textAlign: "center", color: "#192820" }}>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 800 }}>Immovia ist gerade nicht erreichbar</h1>
        <p style={{ color: "#69736D", marginTop: "1rem" }}>Bitte versuchen Sie es in einem Moment erneut.</p>
        <button
          onClick={reset}
          style={{ marginTop: "2rem", background: "#4F7A2A", color: "#fff", border: 0, borderRadius: 12, padding: "0.75rem 1.25rem", fontWeight: 600 }}
        >
          Erneut versuchen
        </button>
      </body>
    </html>
  );
}
