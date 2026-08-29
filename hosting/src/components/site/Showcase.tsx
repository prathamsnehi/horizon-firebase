import { color, font, layout } from "@/lib/tokens";
import { InView } from "@/components/ui/in-view";
import { QuestGenerator } from "./showcase/QuestGenerator";

/**
 * The showcase: a playable demo of the app. Press "Generate" and watch Horizon
 * hand back one quest at a real kind of place, somewhere in the world — the same
 * minimal flow the app runs, served from a pre-generated pool (no backend, so the
 * `/` route stays Firebase-free).
 *
 * Keeps id="steps" so the nav anchors ("How it works" / "Quests") still resolve.
 */
export default function Showcase() {
  return (
    <section id="steps" style={{ background: color.paper, padding: `clamp(72px,10vw,124px) ${layout.gutter}` }}>
      <div
        style={{
          maxWidth: layout.pageMax,
          margin: "0 auto",
          display: "flex",
          flexWrap: "wrap",
          gap: "clamp(40px,7vw,96px)",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Left — intro */}
        <InView
          className="flex-[1_1_400px] min-w-0 max-w-[460px]"
          variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } } }}
        >
          <div style={{ fontFamily: font.display, fontSize: 12.5, fontWeight: 800, letterSpacing: ".2em", color: color.rust, marginBottom: 18 }}>
            SEE IT WORK
          </div>
          <h2 style={{ margin: "0 0 18px", fontFamily: font.display, fontSize: "clamp(32px,4.4vw,50px)", lineHeight: 0.98, fontWeight: 800, letterSpacing: "-.04em", color: color.ink }}>
            One quest. Anywhere. Right now.
          </h2>
          <p style={{ margin: "0 0 20px", fontSize: "clamp(15px,1.5vw,17px)", lineHeight: 1.6, maxWidth: 400, color: color.inkBody }}>
            No sign-up, no feed. Hit the button and watch Horizon do the one thing it does — hand you a single, doable quest at a real kind of place, and nothing else.
          </p>
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, maxWidth: 380, color: color.inkFaint }}>
            This is a live taste with places from around the world. The real app finds them near you.
          </p>
        </InView>

        {/* Right — the interactive generator */}
        <div className="flex-[0_1_380px] min-w-0 w-full max-w-[380px]">
          <QuestGenerator />
        </div>
      </div>
    </section>
  );
}
