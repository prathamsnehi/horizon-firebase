import { color, font, layout } from "../../lib/tokens";

export default function CtaFooter() {
  return (
    <>
      <div id="get" style={{ padding: `clamp(64px,10vw,110px) ${layout.gutter} 60px`, textAlign: "center", background: color.paper }}>
        <div style={{ width: 56, height: 28, background: color.peach, borderRadius: "56px 56px 0 0", margin: "0 auto 22px" }} />
        <h2
          style={{
            margin: "0 0 22px",
            fontFamily: font.condensed,
            fontSize: "clamp(52px,12vw,96px)",
            lineHeight: 0.88,
            fontWeight: 700,
            textTransform: "uppercase",
          }}
        >
          One quest. Today.
        </h2>
        <a
          href="#get"
          style={{
            display: "inline-block",
            padding: "18px clamp(28px,7vw,40px)",
            background: color.ink,
            color: color.peach,
            fontFamily: font.condensed,
            fontSize: "clamp(21px,4vw,26px)",
            fontWeight: 600,
            letterSpacing: ".06em",
            textDecoration: "none",
          }}
        >
          DOWNLOAD HORIZON
        </a>
        <div style={{ marginTop: 18, fontSize: 13.5, color: color.inkFaint }}>iOS, free. Android autumn 2026. No feed, ever.</div>
      </div>
      <div
        style={{
          borderTop: "1px solid rgba(33,29,24,.1)",
          padding: `18px ${layout.gutter}`,
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          fontSize: 12.5,
          color: color.inkFaint,
          background: color.paper,
        }}
      >
        <span>Horizon, 2026</span>
        <span style={{ display: "flex", gap: 22 }}>
          <a href="#get" style={{ color: color.inkFaint, textDecoration: "none" }}>
            Safety
          </a>
          <a href="#get" style={{ color: color.inkFaint, textDecoration: "none" }}>
            Privacy
          </a>
          <a href="#get" style={{ color: color.inkFaint, textDecoration: "none" }}>
            Contact
          </a>
        </span>
      </div>
    </>
  );
}
