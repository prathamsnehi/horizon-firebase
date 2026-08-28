import type { CSSProperties } from "react";
import { color, font, layout } from "../../lib/tokens";
import { useViewportWidth } from "../../lib/useViewport";

/** One taped polaroid. Rest rotation is a CSS var so the `.hz-polaroid:hover`
 *  rule (in index.css) can straighten it to 0deg. */
function PolaroidCard(props: {
  left: number;
  top: number;
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
      className="hz-polaroid"
      style={
        {
          position: "absolute",
          left: props.left,
          top: props.top,
          width: props.width,
          background: color.paperWarm,
          padding: `12px 12px ${props.chin}px`,
          boxShadow: "0 10px 24px -14px rgba(38,34,27,.5)",
          "--rot": `${props.rotation}deg`,
        } as CSSProperties
      }
    >
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: -12,
          transform: `translateX(-50%) rotate(${props.tapeRotation}deg)`,
          width: 76,
          height: 24,
          background: "rgba(255,182,147,.6)",
          border: "1px solid rgba(38,34,27,.1)",
        }}
      />
      <div
        style={{
          height: props.wellHeight,
          background: "repeating-linear-gradient(45deg,rgba(38,34,27,.08) 0 8px,rgba(0,0,0,0) 8px 16px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "0 10px",
        }}
      >
        <span style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: ".14em", textTransform: "uppercase", color: color.inkFaint }}>
          {props.wellLabel}
        </span>
      </div>
      <div style={{ fontFamily: font.hand, fontSize: 20, marginTop: 10 }}>{props.caption}</div>
    </div>
  );
}

export default function Hero() {
  const w = useViewportWidth();
  const narrow = w < 960;
  const tiny = w < 560;
  const polScale = tiny
    ? Math.max(0.5, (w - 24) / 560)
    : narrow
      ? 0.74
      : Math.min(1, Math.max(0.8, (w - 620) / 560));

  return (
    <div style={{ position: "relative", padding: "clamp(40px,7vw,96px) 0 0", boxSizing: "border-box", overflowX: "clip" }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "center",
          gap: layout.heroGap,
          padding: `0 ${layout.gutter}`,
          maxWidth: layout.pageMax,
          margin: "0 auto",
        }}
      >
        {/* Left column */}
        <div style={{ flex: "0 1 500px", minWidth: 0 }}>
          <div style={{ width: 64, height: 2, background: color.ink, marginBottom: "clamp(28px,5vw,54px)" }} />
          <h1
            style={{
              margin: "0 0 30px",
              fontFamily: font.display,
              fontSize: "clamp(38px,6.4vw,64px)",
              lineHeight: 0.96,
              fontWeight: 800,
              letterSpacing: "-.038em",
              maxWidth: 540,
              textWrap: "pretty",
            }}
          >
            Do the thing you keep going around.
          </h1>
          <p style={{ margin: "0 0 38px", fontSize: "clamp(15.5px,1.6vw,17px)", lineHeight: 1.62, maxWidth: 430, color: color.inkBody }}>
            Tell Horizon what you avoid. It hands back one quest at a real place, close enough to walk to before dinner. You go, it
            notices you arrived, and the next one sits further out.
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
            <a
              href="#get"
              style={{
                padding: "15px 28px",
                background: color.ink,
                color: color.paper,
                fontFamily: font.display,
                fontSize: 15,
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              Download for iOS
            </a>
            <span style={{ fontSize: 13, color: color.inkFaint }}>Free · iOS</span>
          </div>
          <div
            style={{
              fontFamily: font.hand,
              fontSize: 23,
              lineHeight: 1.35,
              color: color.inkHand,
              maxWidth: 330,
              marginTop: 34,
              transform: "rotate(-.8deg)",
            }}
          >
            the first quest is almost too easy on purpose — nobody starts at the deep end
          </div>
        </div>

        {/* Right column — the polaroid pair */}
        <div style={{ flex: "0 1 560px", minWidth: 0, height: Math.round(430 * polScale) }}>
          <div style={{ position: "relative", height: 430, width: 560, transform: `scale(${polScale})`, transformOrigin: "top left" }}>
            <PolaroidCard
              left={0}
              top={0}
              width={250}
              rotation={-4}
              tapeRotation={2}
              chin={44}
              wellHeight={190}
              wellLabel="Photo — counter seat"
              caption="table for one, 8.15pm"
            />
            <PolaroidCard
              left={290}
              top={132}
              width={270}
              rotation={3.5}
              tapeRotation={-3}
              chin={40}
              wellHeight={170}
              wellLabel="Photo — cold water, 07:00"
              caption="13°C. did it anyway."
            />
          </div>
        </div>
      </div>
      <div style={{ height: "clamp(40px,6vw,86px)" }} />
    </div>
  );
}
