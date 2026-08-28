import { font } from "../../../lib/tokens";
import type { StoryFrame } from "../../../lib/scrollStory";

interface Beat {
  eyebrow: string;
  heading: string;
  body: string;
  aside?: { text: string; rot: number };
}

const BEAT_COPY: Beat[] = [
  {
    eyebrow: "01 — NAME IT",
    heading: "Say what you avoid, in your own words.",
    body: "No categories, no questionnaire, no personality result at the end. One line is enough.",
  },
  {
    eyebrow: "02 — ONE QUEST BACK",
    heading: "One task. One address. Tonight only.",
    body: "Never a list to choose from — a single card that expires at midnight, so the decision is only ever about today.",
    aside: { text: "we check the place is actually open before it ever reaches you", rot: -0.6 },
  },
  {
    eyebrow: "THE PIN DROPS",
    heading: "Somewhere you could walk to before dinner.",
    body: "You set the radius. Everything Horizon sends sits inside it, on a street you have probably already walked past.",
  },
  {
    eyebrow: "03 — GO",
    heading: "Arrive, and the app goes quiet.",
    body: "No timer, no prompts, no photo to upload while you are standing there. What happens inside the door is yours.",
  },
  {
    eyebrow: "04 — KEEP IT",
    heading: "Finished or abandoned, it goes in the log.",
    body: "The radius widens after every attempt. Nothing is posted anywhere, and nobody else can see it.",
    aside: { text: "turning around at the door still counts. that one took me three tries.", rot: 0.5 },
  },
];

export default function CopyBeats({ frame }: { frame: StoryFrame }) {
  return (
    <div
      style={{
        position: "absolute",
        left: frame.copyLeft,
        top: frame.copyTop,
        transform: "translate(-50%,-50%)",
        width: frame.copyW,
        height: frame.copyBoxH,
      }}
    >
      {BEAT_COPY.map((beat, i) => {
        const m = frame.copy[i];
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              opacity: m.o,
              transform: `translateX(${m.x})`,
              pointerEvents: m.pe as "auto" | "none",
            }}
          >
            <div style={{ fontFamily: font.display, fontSize: 12.5, fontWeight: 800, letterSpacing: ".2em", color: "#FFB693", marginBottom: 20 }}>
              {beat.eyebrow}
            </div>
            <h2
              style={{
                margin: "0 0 16px",
                fontFamily: font.display,
                fontSize: frame.h2Size,
                lineHeight: 0.98,
                fontWeight: 800,
                letterSpacing: "-.04em",
                color: "#F7F1EA",
              }}
            >
              {beat.heading}
            </h2>
            <p style={{ margin: beat.aside ? "0 0 18px" : 0, fontSize: frame.pSize, lineHeight: 1.55, color: "rgba(247,241,234,.66)", maxWidth: 430 }}>
              {beat.body}
            </p>
            {beat.aside && (
              <div style={{ display: frame.asideShow, fontFamily: font.hand, fontSize: 22, color: "rgba(255,182,147,.8)", transform: `rotate(${beat.aside.rot}deg)` }}>
                {beat.aside.text}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
