export function UnderlineSwoosh({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 220 14" fill="none" preserveAspectRatio="none" aria-hidden className={className}>
      {/* pathLength 1: der Strich lässt sich unabhängig von der Breite zeichnen (stroke-dashoffset) */}
      <path d="M3 10.5C55 3.5 140 1.8 217 6.2" pathLength={1} stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" />
    </svg>
  );
}
