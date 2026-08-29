/**
 * A fixed, ultra-subtle film-grain overlay for the whole marketing page — the kind
 * of tactile texture high-end sites use so flat colour never reads as "digital
 * flat". Non-interactive (pointer-events: none) and very low opacity.
 */
const NOISE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`
  );

export function Grain() {
  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        pointerEvents: "none",
        opacity: 0.038,
        mixBlendMode: "multiply",
        backgroundImage: `url("${NOISE}")`,
        backgroundSize: "140px 140px",
      }}
    />
  );
}
