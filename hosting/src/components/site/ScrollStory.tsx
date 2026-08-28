import { useEffect, useRef, useState } from "react";
import { scrollProgressLoop, storyFrame } from "../../lib/scrollStory";
import CityGround from "./story/CityGround";
import CopyBeats from "./story/CopyBeats";
import PhoneMock from "./story/PhoneMock";

/**
 * The pinned scroll-story section. Owns the only state — `p` (smoothed scroll
 * progress) and the viewport — and derives every animated value per render via
 * `storyFrame`. The outer section is tall (5 × scrollPerStep + 90vh); a sticky
 * child holds the stage while the page scrolls past it.
 */
export default function ScrollStory() {
  const ref = useRef<HTMLDivElement>(null);
  const [vp, setVp] = useState(() => ({
    p: 0,
    w: typeof window !== "undefined" ? window.innerWidth : 1200,
    h: typeof window !== "undefined" ? window.innerHeight : 900,
  }));

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return scrollProgressLoop(el, setVp);
  }, []);

  const frame = storyFrame(vp.p, { w: vp.w, h: vp.h });

  return (
    <div id="steps" ref={ref} style={{ position: "relative", height: frame.scrollHeight, background: frame.bgColor }}>
      <div style={{ position: "sticky", top: 0, height: "100vh", minHeight: frame.stickyMinH, overflow: "hidden", boxSizing: "border-box" }}>
        {/* z1 — ground */}
        <CityGround frame={frame} />

        {/* z2 — pin drop (world space, in front of the ground) */}
        <div
          style={{
            position: "absolute",
            left: frame.dropX,
            top: frame.dropY,
            transform: "translate(-50%,-100%)",
            opacity: frame.dropOpacity,
            transition: "opacity .2s linear",
          }}
        >
          <div style={{ width: frame.dropSize, height: frame.dropSize, borderRadius: "50% 50% 50% 0", background: "#FFB693", transform: "rotate(-45deg)", boxShadow: "0 14px 34px -8px rgba(255,182,147,.55)" }} />
        </div>
        <div
          style={{
            position: "absolute",
            left: frame.dropX,
            top: frame.dropY,
            transform: "translate(-50%,-50%)",
            width: frame.ringSize,
            height: frame.ringSize,
            borderRadius: "50%",
            border: `1px solid rgba(255,182,147,${frame.ringAlpha})`,
            pointerEvents: "none",
          }}
        />

        {/* z3/z4 — copy + phone */}
        <div style={{ position: "absolute", inset: 0 }}>
          <CopyBeats frame={frame} />
          <PhoneMock frame={frame} />
        </div>

        {/* z5 — progress rail */}
        <div
          style={{
            position: "absolute",
            right: "clamp(14px,2.4vw,30px)",
            top: "50%",
            transform: "translateY(-50%)",
            display: frame.railShow,
            flexDirection: "column",
            gap: 12,
            alignItems: "center",
            opacity: frame.chromeOpacity,
          }}
        >
          {frame.ticks.map((t, i) => (
            <span key={i} style={{ width: 2, height: t.h, background: t.color, transition: "height .2s ease,background .2s ease" }} />
          ))}
        </div>

        {/* z6 — vignette */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", boxShadow: `inset 0 0 ${frame.vigSize} ${frame.vigInner} rgba(6,4,3,${frame.vigAlpha})` }} />
      </div>
    </div>
  );
}
