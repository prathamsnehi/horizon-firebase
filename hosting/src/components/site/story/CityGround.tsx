import type { StoryFrame } from "../../../lib/scrollStory";

/** The 3D ground plane — a stylised SF Financial District receding under the
 *  phone. Bottom-anchored rotateX is required (a top origin inverts the surface). */
export default function CityGround({ frame }: { frame: StoryFrame }) {
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: frame.groundTop,
        bottom: 0,
        overflow: "hidden",
        opacity: frame.mapOpacity,
        perspective: "1100px",
        perspectiveOrigin: "50% 100%",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 1500,
          transform: `rotateX(63deg) translateX(${frame.panX})`,
          transformOrigin: "50% 100%",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "#070605",
            backgroundImage:
              "linear-gradient(rgba(255,214,190,.09) 1px,transparent 1px),linear-gradient(90deg,rgba(255,214,190,.08) 1px,transparent 1px)",
            backgroundSize: "132px 104px",
          }}
        />
        {/* Market Street */}
        <div style={{ position: "absolute", left: "-30%", right: "-30%", top: 790, height: 96, background: "rgba(255,214,190,.13)", transform: "rotate(-9deg)" }} />
        {/* The Bay */}
        <div style={{ position: "absolute", left: "-30%", right: "-30%", top: 1160, height: 420, background: "rgba(96,124,158,.18)", transform: "rotate(-9deg)" }} />
        {frame.blocks.map((b, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: b.x,
              top: b.y,
              width: b.w,
              height: b.h,
              background: b.face,
              boxShadow: `0 ${b.rise} 0 ${b.side}`,
              borderTop: `1px solid ${b.edge}`,
              transform: `rotate(${b.rot})`,
            }}
          />
        ))}
        {frame.mapPins.map((m, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: m.x,
              top: m.y,
              width: m.s,
              height: m.s,
              borderRadius: "50%",
              background: `rgba(255,182,147,${m.a})`,
              transform: "translate(-50%,-50%)",
            }}
          />
        ))}
      </div>
      {/* Horizon fade — keep short, a taller fade washes the whole city out. */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          height: 54,
          background: `linear-gradient(180deg,${frame.bgColor} 0%,rgba(0,0,0,0) 100%)`,
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
