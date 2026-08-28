import { color, font, layout } from "../../lib/tokens";

/** Scrolls away normally (fixed nothing). Nav text links hide below 560px. */
export default function SiteHeader() {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 16,
        flexWrap: "wrap",
        padding: `20px ${layout.gutter}`,
        position: "relative",
        zIndex: 5,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
        <span style={{ width: 22, height: 11, background: color.peach, borderRadius: "22px 22px 0 0", display: "block" }} />
        <span style={{ fontFamily: font.display, fontWeight: 800, fontSize: 18, letterSpacing: "-.01em" }}>Horizon</span>
      </div>
      <div style={{ display: "flex", gap: "clamp(14px,3vw,26px)", alignItems: "center", fontSize: 13.5, color: color.inkMuted }}>
        <a className="hidden min-[560px]:inline" href="#steps" style={{ color: color.inkMuted, textDecoration: "none" }}>
          How it works
        </a>
        <a className="hidden min-[560px]:inline" href="#steps" style={{ color: color.inkMuted, textDecoration: "none" }}>
          Quests
        </a>
        <a
          href="#get"
          style={{
            fontFamily: font.display,
            fontSize: 14,
            fontWeight: 700,
            color: color.ink,
            background: color.peach,
            padding: "9px 17px",
            textDecoration: "none",
          }}
        >
          Get it free
        </a>
      </div>
    </div>
  );
}
