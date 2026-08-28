import type { CSSProperties } from "react";
import { font } from "../../../lib/tokens";
import type { StoryFrame } from "../../../lib/scrollStory";

/**
 * The phone mockup that crosses the stage, plus its five hand-built screens.
 *
 * NOTE (from the handoff): the screens are CSS approximations of the app UI, the
 * weakest part of the design — the plan is to replace each with a muted screen
 * recording. To swap one, drop a <video muted playsInline autoPlay loop> filling
 * the screen div in place of its contents (files under public/, not imported).
 */

const eyebrow: CSSProperties = {
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: ".14em",
  textTransform: "uppercase",
  color: "#A0552A",
};
const mapBg: CSSProperties = {
  position: "absolute",
  inset: 0,
  background: "#EFEBE2",
  backgroundImage: "linear-gradient(rgba(33,29,24,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(33,29,24,.06) 1px,transparent 1px)",
  backgroundSize: "34px 34px",
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ borderTop: "1px solid rgba(33,29,24,.12)", padding: "11px 0", display: "flex", justifyContent: "space-between", fontSize: 13 }}>
      <span style={{ color: "#8A8073" }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function LogRow({ opacity, title, place, status, done }: { opacity: number; title: string; place: string; status: string; done: boolean; last?: boolean }) {
  return (
    <div style={{ borderTop: "1px solid rgba(33,29,24,.12)", padding: "14px 0", opacity }}>
      <div style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.3, marginBottom: 5 }}>{title}</div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "#8A8073" }}>
        <span>{place}</span>
        <span style={{ color: done ? "#4A7A5C" : "#8A8073", fontWeight: 700 }}>{status}</span>
      </div>
    </div>
  );
}

export default function PhoneMock({ frame }: { frame: StoryFrame }) {
  const s = frame.screens;
  return (
    <div
      style={{
        position: "absolute",
        left: frame.phoneLeft,
        top: frame.phoneTop,
        transform: "translate(-50%,-50%)",
        width: frame.phoneBoxW,
        height: frame.phoneBoxH,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        perspective: "1600px",
      }}
    >
      <div
        style={{
          position: "absolute",
          width: frame.glowSize,
          height: frame.glowSize,
          borderRadius: "50%",
          background: "radial-gradient(circle,rgba(255,182,147,.32),rgba(255,182,147,0) 68%)",
          transform: `translate(${frame.glowX},0)`,
        }}
      />
      <div style={{ position: "relative", transform: `scale(${frame.phoneScale}) rotateY(${frame.tiltY}) rotateX(${frame.tiltX})`, transformStyle: "preserve-3d" }}>
        <div style={{ position: "absolute", left: "8%", right: "8%", bottom: -30, height: 52, borderRadius: "50%", background: "rgba(0,0,0,.7)", filter: "blur(24px)", transform: `translateX(${frame.shadowX})` }} />
        <div
          style={{
            position: "relative",
            width: 320,
            height: 660,
            border: "1px solid rgba(247,241,234,.22)",
            borderRadius: 48,
            background: "#0B0907",
            padding: 12,
            boxSizing: "border-box",
            boxShadow: "0 50px 90px -40px rgba(0,0,0,.9),inset 0 0 0 1px rgba(247,241,234,.06)",
          }}
        >
          <div style={{ position: "absolute", left: "50%", top: 20, transform: "translateX(-50%)", width: 100, height: 26, background: "#0B0907", borderRadius: 100, zIndex: 4 }} />
          <div style={{ position: "relative", height: "100%", borderRadius: 37, background: "#FBF8F3", overflow: "hidden" }}>
            {/* Screen 1 — name it */}
            <div style={{ position: "absolute", inset: 0, padding: "62px 22px 22px", boxSizing: "border-box", opacity: s[0].o, transform: `translateY(${s[0].y})` }}>
              <div style={{ ...eyebrow, marginBottom: 18 }}>New quest</div>
              <div style={{ fontFamily: font.display, fontSize: 25, fontWeight: 800, letterSpacing: "-.03em", lineHeight: 1.12, marginBottom: 22 }}>
                What have you been going around?
              </div>
              <div style={{ border: "1px solid rgba(33,29,24,.2)", background: "#fff", padding: 14, minHeight: 86, fontSize: 15, lineHeight: 1.5, color: "#211D18" }}>
                {frame.typed}
                <span style={{ display: "inline-block", width: 2, height: 17, background: "#A0552A", verticalAlign: -3, animation: "hzBlink 1s steps(1) infinite" }} />
              </div>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 16 }}>
                {["eating alone", "cold water", "speaking up"].map((c) => (
                  <span key={c} style={{ padding: "7px 12px", border: "1px solid rgba(33,29,24,.16)", borderRadius: 100, fontSize: 12, color: "#6E6659" }}>
                    {c}
                  </span>
                ))}
              </div>
              <div style={{ position: "absolute", left: 22, right: 22, bottom: 26, background: "#211D18", color: "#FBF8F3", textAlign: "center", padding: 15, fontSize: 14.5, fontWeight: 700 }}>
                Find me one quest
              </div>
            </div>

            {/* Screen 2 — the quest card */}
            <div style={{ position: "absolute", inset: 0, padding: "62px 22px 22px", boxSizing: "border-box", opacity: s[1].o, transform: `translateY(${s[1].y})` }}>
              <div style={{ ...eyebrow, marginBottom: 18 }}>Tonight · expires 00:00</div>
              <div style={{ border: "1px solid rgba(33,29,24,.16)", background: "#fff", padding: "22px 20px", boxShadow: "0 18px 30px -26px rgba(33,29,24,.9)" }}>
                <div style={{ display: "flex", gap: 5, marginBottom: 18 }}>
                  {[0, 1, 2, 3, 4].map((i) => (
                    <span key={i} style={{ width: 7, height: 7, borderRadius: 9, background: i === 0 ? "#FFB693" : "rgba(33,29,24,.14)" }} />
                  ))}
                </div>
                <div style={{ fontFamily: font.display, fontSize: 23, fontWeight: 800, letterSpacing: "-.025em", lineHeight: 1.15, marginBottom: 18 }}>
                  Eat a full meal alone at the counter
                </div>
                <Row label="Place" value="Little Sicily" />
                <Row label="Distance" value="0.4 mi · 9 min" />
                <Row label="Open until" value="22:00" />
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.55, color: "#6E6659", marginTop: 16 }}>Sit at the counter, not a table. Three courses. Phone in your pocket.</div>
              <div style={{ position: "absolute", left: 22, right: 22, bottom: 26, background: "#FFB693", color: "#211D18", textAlign: "center", padding: 15, fontSize: 14.5, fontWeight: 700 }}>
                Accept · start walking
              </div>
            </div>

            {/* Screen 3 — the pin on the map */}
            <div style={{ position: "absolute", inset: 0, opacity: s[2].o, transform: `translateY(${s[2].y})` }}>
              <div style={mapBg} />
              <span style={{ position: "absolute", left: -30, top: 150, width: 380, height: 70, background: "rgba(120,150,190,.16)", transform: "rotate(-12deg)" }} />
              <span style={{ position: "absolute", left: 0, right: 0, top: "62%", height: 12, background: "rgba(33,29,24,.06)" }} />
              <span style={{ position: "absolute", top: 0, bottom: 0, left: "30%", width: 12, background: "rgba(33,29,24,.06)" }} />
              <div style={{ position: "absolute", left: "50%", top: "56%", transform: "translate(-50%,-100%)", opacity: frame.pinInPhone }}>
                <div style={{ width: 26, height: 26, borderRadius: "50% 50% 50% 0", background: "#A0552A", transform: "rotate(-45deg)" }} />
              </div>
              <div style={{ position: "absolute", left: 22, right: 22, top: 62, background: "#fff", border: "1px solid rgba(33,29,24,.14)", padding: "16px 18px" }}>
                <div style={{ ...eyebrow, marginBottom: 8 }}>Pinned to your map</div>
                <div style={{ fontFamily: font.display, fontSize: 26, fontWeight: 800, letterSpacing: "-.03em" }}>0.4 mi away</div>
                <div style={{ fontSize: 13, color: "#6E6659", marginTop: 4 }}>Little Sicily, 4th &amp; Vine · open until 22:00</div>
              </div>
            </div>

            {/* Screen 4 — walking there */}
            <div style={{ position: "absolute", inset: 0, opacity: s[3].o, transform: `translateY(${s[3].y})` }}>
              <div style={mapBg} />
              <span style={{ position: "absolute", left: -30, top: 120, width: 380, height: 70, background: "rgba(120,150,190,.16)", transform: "rotate(-12deg)" }} />
              <span style={{ position: "absolute", left: 0, right: 0, top: "58%", height: 12, background: "rgba(33,29,24,.06)" }} />
              <span style={{ position: "absolute", top: 0, bottom: 0, left: "30%", width: 12, background: "rgba(33,29,24,.06)" }} />
              <div style={{ position: "absolute", left: 26, right: 26, top: 200, height: 3, background: "rgba(33,29,24,.14)" }}>
                <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, background: "#A0552A", width: frame.routePct }} />
              </div>
              <span style={{ position: "absolute", left: 26, top: 194, width: 15, height: 15, borderRadius: "50%", background: "#211D18", border: "3px solid #FBF8F3" }} />
              <span style={{ position: "absolute", right: 26, top: 194, width: 15, height: 15, borderRadius: "50%", background: "#A0552A", border: "3px solid #FBF8F3" }} />
              <span style={{ position: "absolute", left: frame.walkerX, top: 201.5, width: 13, height: 13, borderRadius: "50%", background: "rgba(33,29,24,.4)", animation: "hzPulseC 2.2s ease-in-out infinite" }} />
              <div style={{ position: "absolute", left: 22, right: 22, top: 62, background: "#fff", border: "1px solid rgba(33,29,24,.14)", padding: "16px 18px" }}>
                <div style={{ ...eyebrow, marginBottom: 8 }}>Walking there</div>
                <div style={{ fontFamily: font.display, fontSize: 30, fontWeight: 800, letterSpacing: "-.03em" }}>{frame.remaining}</div>
                <div style={{ fontSize: 13, color: "#6E6659", marginTop: 4 }}>Little Sicily, 4th &amp; Vine</div>
              </div>
              <div style={{ position: "absolute", left: 22, right: 22, bottom: 26, background: "#fff", border: "1px solid rgba(33,29,24,.14)", padding: "15px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 13.5, color: "#4A4338" }}>{frame.arrivalNote}</span>
                <span style={{ width: 26, height: 26, borderRadius: "50%", background: frame.arrivalDot, flex: "0 0 auto" }} />
              </div>
            </div>

            {/* Screen 5 — the private log */}
            <div style={{ position: "absolute", inset: 0, padding: "62px 22px 22px", boxSizing: "border-box", opacity: s[4].o, transform: `translateY(${s[4].y})` }}>
              <div style={{ ...eyebrow, marginBottom: 8 }}>Your log · private</div>
              <div style={{ fontFamily: font.display, fontSize: 25, fontWeight: 800, letterSpacing: "-.03em", marginBottom: 20 }}>14 closed · radius 2.0 mi</div>
              <LogRow opacity={frame.logRows[0]} title="Eat a full meal alone at the counter" place="Little Sicily · 0.4 mi" status="COMPLETED" done />
              <LogRow opacity={frame.logRows[1]} title="Ask a stranger for directions" place="Union Square · 0.9 mi" status="COMPLETED" done />
              <LogRow opacity={frame.logRows[2]} title="Sing where people can hear you" place="The Basement · 1.6 mi" status="ABANDONED" done={false} />
              <div style={{ borderBottom: "1px solid rgba(33,29,24,.12)" }}>
                <LogRow opacity={frame.logRows[3]} title="Cold water past the shoulders" place="Baker Beach · 3.2 mi" status="COMPLETED" done last />
              </div>
            </div>

            {/* bottom fade */}
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 76, background: "linear-gradient(180deg,rgba(251,248,243,0),rgba(251,248,243,.9))", pointerEvents: "none" }} />
          </div>
        </div>
      </div>
    </div>
  );
}
