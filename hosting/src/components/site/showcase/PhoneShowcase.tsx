import { useEffect, useRef, useState } from "react";
import { motion, useMotionValueEvent, useReducedMotion, useScroll } from "motion/react";
import { color, font, layout } from "@/lib/tokens";

/**
 * Scroll-scrubbed showcase. The section is pinned; scroll position drives the
 * active clip's playback frame-by-frame (stop scrolling → the frame freezes). Each
 * clip owns a slice of the scroll; crossing into the next flips the row direction
 * so the phone slides to the other side and the text swaps with it (a zigzag,
 * animated via `layout`). Clips live in public/showcase as <base>.mp4 + <base>.jpg
 * poster. Under reduced motion the clips aren't scrubbed — the poster shows per
 * step and the swap snaps.
 */
const SCREENS = [
  { base: "/showcase/app-01-name", label: "Name it", caption: "Say what you keep going around — one line, your words." },
  { base: "/showcase/app-02-quest", label: "One quest back", caption: "One task, one address, expiring at midnight. Never a list." },
  { base: "/showcase/app-03-map", label: "On the map", caption: "A real place inside your radius — walkable before dinner." },
  { base: "/showcase/app-04-log", label: "Into the log", caption: "Post how it went. The radius widens, and it stays private." },
];
const N = SCREENS.length;
const STEP_VH = 320; // scroll length per clip — long, so normal-speed scrolling still scrubs smoothly
const SCREEN_W = 300;
const SCREEN_H = 650;

export function PhoneShowcase() {
  const reduce = useReducedMotion() ?? false;
  const [vp, setVp] = useState(() => ({ w: typeof window !== "undefined" ? window.innerWidth : 1200, h: typeof window !== "undefined" ? window.innerHeight : 900 }));
  const [clipIndex, setClipIndex] = useState(0);
  const [failed, setFailed] = useState(false);

  const sectionRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const durationRef = useRef(0);
  const idxRef = useRef(0);

  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end end"] });

  const applyScrub = (p: number) => {
    const total = Math.min(N - 0.0001, Math.max(0, p * N));
    const idx = Math.floor(total);
    const local = total - idx;
    if (idx !== idxRef.current) {
      idxRef.current = idx;
      setClipIndex(idx);
      setFailed(false);
    }
    const v = videoRef.current;
    if (v && durationRef.current > 0) {
      const t = Math.min(durationRef.current - 0.05, local * durationRef.current);
      if (Math.abs(v.currentTime - t) > 0.01) v.currentTime = t;
    }
  };
  useMotionValueEvent(scrollYProgress, "change", applyScrub);

  useEffect(() => {
    const on = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);

  const onMeta = () => {
    const v = videoRef.current;
    if (!v) return;
    durationRef.current = v.duration || 0;
    applyScrub(scrollYProgress.get());
  };

  const narrow = vp.w < 860;
  const gutter = Math.min(48, Math.max(20, vp.w * 0.05));
  const scale = narrow
    ? Math.max(0.5, Math.min((vp.w - 40) / (SCREEN_W + 24), (vp.h - 300) / (SCREEN_H + 24), 1))
    : Math.max(0.5, Math.min((vp.w * 0.42) / (SCREEN_W + 24), (vp.h - 190) / (SCREEN_H + 24), 1));

  const s = SCREENS[clipIndex];
  const phoneLeft = clipIndex % 2 === 0;
  const swap = reduce ? { duration: 0 } : { type: "spring" as const, stiffness: 120, damping: 20, mass: 0.9 };

  const z = scale; // scale every dimension so the layout box == the visual box (centers reliably)
  const bezelW = (SCREEN_W + 24) * z;
  const bezelH = (SCREEN_H + 24) * z;
  const phone = (
    <div style={{ position: "relative", width: bezelW, height: bezelH }}>
      <div aria-hidden style={{ position: "absolute", left: "50%", top: "50%", width: bezelW * 1.15, height: bezelH * 0.55, transform: "translate(-50%,-50%)", borderRadius: "50%", background: "radial-gradient(circle, rgba(255,182,147,.4), rgba(255,182,147,0) 68%)", filter: "blur(30px)" }} />
      <div
        style={{
          position: "relative",
          width: bezelW,
          height: bezelH,
          borderRadius: 54 * z,
          background: "linear-gradient(145deg, #2a2622, #0b0907)",
          padding: 12 * z,
          boxSizing: "border-box",
          boxShadow: `0 ${60 * z}px ${100 * z}px ${-44 * z}px rgba(38,34,27,.6), inset 0 0 0 1.5px rgba(247,241,234,.1)`,
        }}
      >
        <span aria-hidden style={{ position: "absolute", left: -3 * z, top: 150 * z, width: 3 * z, height: 58 * z, borderRadius: 3 * z, background: "#1a1613" }} />
        <span aria-hidden style={{ position: "absolute", right: -3 * z, top: 132 * z, width: 3 * z, height: 78 * z, borderRadius: 3 * z, background: "#1a1613" }} />
        <div style={{ position: "relative", width: SCREEN_W * z, height: SCREEN_H * z, borderRadius: 42 * z, overflow: "hidden", background: "#000" }}>
          {failed ? (
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, background: color.paper, padding: 24, textAlign: "center" }}>
              <span style={{ width: 48, height: 24, background: color.peach, borderRadius: "48px 48px 0 0" }} />
              <div style={{ fontFamily: font.display, fontSize: 17, fontWeight: 800, letterSpacing: "-.02em", color: color.ink }}>{s.label}</div>
              <div style={{ fontSize: 12, color: color.inkFaint }}>clip goes here</div>
            </div>
          ) : reduce ? (
            <img key={s.base} src={`${s.base}.jpg`} alt={s.label} onError={() => setFailed(true)} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          ) : (
            <video
              ref={videoRef}
              key={s.base}
              src={`${s.base}.mp4`}
              poster={`${s.base}.jpg`}
              muted
              playsInline
              preload="auto"
              controls={false}
              onLoadedMetadata={onMeta}
              onError={() => setFailed(true)}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          )}
        </div>
      </div>
    </div>
  );

  const text = (
    <motion.div key={clipIndex} initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduce ? 0 : 0.4, ease: [0.16, 1, 0.3, 1] }} style={{ textAlign: narrow ? "center" : "left" }}>
      <div style={{ fontFamily: font.display, fontSize: 12.5, fontWeight: 800, letterSpacing: ".2em", color: color.rust, marginBottom: 14 }}>{`SEE IT WORK · 0${clipIndex + 1}`}</div>
      <h2 style={{ margin: "0 0 16px", fontFamily: font.display, fontSize: "clamp(30px,4vw,50px)", fontWeight: 800, letterSpacing: "-.04em", lineHeight: 1, color: color.ink }}>{s.label}.</h2>
      <p style={{ margin: 0, fontSize: "clamp(15px,1.6vw,18px)", lineHeight: 1.6, color: color.inkBody }}>{s.caption}</p>
    </motion.div>
  );

  return (
    <div ref={sectionRef} style={{ position: "relative", height: `${N * STEP_VH}vh` }}>
      <div style={{ position: "sticky", top: 0, height: "100vh", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", padding: `0 ${gutter}px`, boxSizing: "border-box" }}>
        {narrow ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 28, maxWidth: 440 }}>
            {phone}
            {text}
          </div>
        ) : (
          <motion.div style={{ display: "flex", flexDirection: phoneLeft ? "row" : "row-reverse", alignItems: "center", justifyContent: "center", gap: "clamp(30px,6vw,110px)", width: "100%", maxWidth: layout.pageMax }}>
            <motion.div layout transition={swap} style={{ flexShrink: 0 }}>
              {phone}
            </motion.div>
            <motion.div layout transition={swap} style={{ width: "min(420px, 40%)", flexShrink: 0 }}>
              {text}
            </motion.div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
