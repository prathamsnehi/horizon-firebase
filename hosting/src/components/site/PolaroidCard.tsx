import type { CSSProperties } from "react";
import { color, font } from "@/lib/tokens";

/**
 * One taped polaroid — the signature hero element, kept pixel-faithful to the
 * original design. Positioning is handled by the parent; this renders just the
 * card, with its rest rotation as a static transform (the hero wraps it in Tilt
 * for the 3D mouse-parallax on top).
 */
export function PolaroidCard({
  width,
  rotation,
  tapeRotation,
  chin,
  wellHeight,
  wellLabel,
  caption,
}: {
  width: number;
  rotation: number;
  tapeRotation: number;
  chin: number;
  wellHeight: number;
  wellLabel: string;
  caption: string;
}) {
  return (
    <div
      style={
        {
          position: "relative",
          width,
          background: color.paperWarm,
          padding: `12px 12px ${chin}px`,
          boxShadow: "0 22px 44px -20px rgba(38,34,27,.55), 0 4px 10px -6px rgba(38,34,27,.3)",
          transform: `rotate(${rotation}deg)`,
        } as CSSProperties
      }
    >
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: -12,
          transform: `translateX(-50%) rotate(${tapeRotation}deg)`,
          width: 76,
          height: 24,
          background: "rgba(255,182,147,.6)",
          border: "1px solid rgba(38,34,27,.1)",
        }}
      />
      <div
        style={{
          height: wellHeight,
          background: "repeating-linear-gradient(45deg,rgba(38,34,27,.08) 0 8px,rgba(0,0,0,0) 8px 16px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "0 10px",
        }}
      >
        <span style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: ".14em", textTransform: "uppercase", color: color.inkFaint }}>
          {wellLabel}
        </span>
      </div>
      <div style={{ fontFamily: font.hand, fontSize: 20, marginTop: 10 }}>{caption}</div>
    </div>
  );
}
