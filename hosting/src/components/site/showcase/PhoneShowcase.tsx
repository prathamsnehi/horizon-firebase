import { useEffect, useRef, useState } from "react";
import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
} from "motion/react";
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
  {
    base: "/showcase/app-01-name",
    label: "Pick your fears",
    caption: "Swipe a deck of hesitations. Tap the ones that are yours.",
  },
  {
    base: "/showcase/app-02-quest",
    label: "Get tailored quests",
    caption:
      "A handful, curated for you. Or describe your own and it builds it.",
  },
  {
    base: "/showcase/app-03-map",
    label: "On the map",
    caption:
      "Usually twenty minutes or so away. Never further than you asked for.",
  },
  {
    base: "/showcase/app-04-log",
    label: "Into the log",
    caption: "Post how it went. It stays yours, and nothing is keeping score.",
  },
];
const N = SCREENS.length;
const STEP_VH = 320; // scroll length per clip — long, so normal-speed scrolling still scrubs smoothly
const SCREEN_W = 300;
const SCREEN_H = 650;
/** Height of the fixed StickyHeader. The pinned area is padded down by this, so
 *  the content centres in the band between the nav's bottom edge and the bottom
 *  of the screen — not in the full viewport, where the nav overlay would always
 *  make it read high. */
const NAV_SAFE = 66;
/** Breathing room kept above and below the phone inside that band. */
const BREATH = 24;
/** Gap between the phone and the caption in the stacked (narrow) layout. */
const STACK_GAP = 28;

export function PhoneShowcase() {
  const reduce = useReducedMotion() ?? false;
  const [vp, setVp] = useState(() => ({
    w: typeof window !== "undefined" ? window.innerWidth : 1200,
    h: typeof window !== "undefined" ? window.innerHeight : 900,
  }));
  const [clipIndex, setClipIndex] = useState(0);
  const [failed, setFailed] = useState(false);

  const narrow = vp.w < 860;
  const gutter = Math.min(48, Math.max(20, vp.w * 0.05));

  const sectionRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  // Real rendered height of the caption block, so the stacked layout sizes the
  // phone against what the text actually occupies instead of a guessed constant.
  const [textH, setTextH] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const durationRef = useRef(0);
  const idxRef = useRef(0);
  // iOS Safari will not paint a frame from a currentTime seek on a video that
  // has never played: the poster is dropped on seek and nothing is decoded
  // behind it, so the phone screen goes blank. Playing and immediately pausing
  // forces a decode. Allowed without a gesture because the video is muted +
  // playsInline — except in Low Power Mode, which is what the touch fallback is
  // for. Desktop decodes on seek regardless, so this is a no-op there.
  const primedRef = useRef(false);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  const applyScrub = (p: number) => {
    const total = Math.min(N - 0.0001, Math.max(0, p * N));
    const idx = Math.floor(total);
    const local = total - idx;
    if (idx !== idxRef.current) {
      idxRef.current = idx;
      setClipIndex(idx);
      setFailed(false);
      // The next <video> mounts fresh, so the old clip's duration must not be
      // used to seek it — clips run 5.9s to 23.3s, and mixing them up lands the
      // playhead in the wrong place until onLoadedMetadata arrives. Zero here
      // means "don't seek yet"; onMeta sets the real value and re-applies.
      durationRef.current = 0;
    }
    const v = videoRef.current;
    if (v && durationRef.current > 0) {
      const t = Math.min(
        durationRef.current - 0.05,
        local * durationRef.current,
      );
      if (Math.abs(v.currentTime - t) > 0.01) v.currentTime = t;
    }
  };
  useMotionValueEvent(scrollYProgress, "change", applyScrub);

  useEffect(() => {
    const on = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);

  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setTextH(e.contentRect.height));
    ro.observe(el);
    setTextH(el.getBoundingClientRect().height);
    return () => ro.disconnect();
  }, [narrow]);

  const prime = () => {
    const v = videoRef.current;
    if (!v) return;
    const played = v.play();
    if (played && typeof played.then === "function") {
      played
        .then(() => {
          v.pause();
          primedRef.current = true;
          applyScrub(scrollYProgress.get());
        })
        .catch(() => {
          // Blocked (Low Power Mode / no gesture yet) — the touch handler retries.
        });
    } else {
      v.pause();
      primedRef.current = true;
    }
  };

  // Retry priming on the visitor's first touch, which on a phone is the same
  // gesture that starts the scroll, so the clip is decoded before it matters.
  useEffect(() => {
    const onFirstTouch = () => {
      if (!primedRef.current) prime();
    };
    window.addEventListener("touchstart", onFirstTouch, { passive: true });
    window.addEventListener("pointerdown", onFirstTouch, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onFirstTouch);
      window.removeEventListener("pointerdown", onFirstTouch);
    };
  }, []);

  const onMeta = () => {
    const v = videoRef.current;
    if (!v) return;
    durationRef.current = v.duration || 0;
    // Each clip mounts a fresh <video> (keyed by base), so every one needs priming.
    primedRef.current = false;
    prime();
    applyScrub(scrollYProgress.get());
  };

  // Vertical room the phone may occupy inside the below-the-nav band: the nav
  // strip comes off the top, BREATH off each end, and the stacked layout also
  // gives up the measured caption height plus its gap.
  const roomH = vp.h - NAV_SAFE - BREATH * 2 - (narrow ? textH + STACK_GAP : 0);
  // No lower clamp: the phone must always fit the viewport it is centred in — a
  // floor here is what previously pushed it up under the nav on short screens.
  const scale = Math.min(
    narrow ? (vp.w - 40) / (SCREEN_W + 24) : (vp.w * 0.42) / (SCREEN_W + 24),
    Math.max(0, roomH) / (SCREEN_H + 24),
    1,
  );

  const s = SCREENS[clipIndex];
  const phoneLeft = clipIndex % 2 === 0;
  const swap = reduce
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 120, damping: 20, mass: 0.9 };

  const z = scale; // scale every dimension so the layout box == the visual box (centers reliably)
  const bezelW = (SCREEN_W + 24) * z;
  const bezelH = (SCREEN_H + 24) * z;
  const phone = (
    <div style={{ position: "relative", width: bezelW, height: bezelH }}>
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: bezelW * 1.15,
          height: bezelH * 0.55,
          transform: "translate(-50%,-50%)",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(255,182,147,.4), rgba(255,182,147,0) 68%)",
          filter: "blur(30px)",
        }}
      />
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
        <span
          aria-hidden
          style={{
            position: "absolute",
            left: -3 * z,
            top: 150 * z,
            width: 3 * z,
            height: 58 * z,
            borderRadius: 3 * z,
            background: "#1a1613",
          }}
        />
        <span
          aria-hidden
          style={{
            position: "absolute",
            right: -3 * z,
            top: 132 * z,
            width: 3 * z,
            height: 78 * z,
            borderRadius: 3 * z,
            background: "#1a1613",
          }}
        />
        <div
          style={{
            position: "relative",
            width: SCREEN_W * z,
            height: SCREEN_H * z,
            borderRadius: 42 * z,
            overflow: "hidden",
            background: "#000",
          }}
        >
          {failed ? (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 14,
                background: color.paper,
                padding: 24,
                textAlign: "center",
              }}
            >
              <span
                style={{
                  width: 48,
                  height: 24,
                  background: color.peach,
                  borderRadius: "48px 48px 0 0",
                }}
              />
              <div
                style={{
                  fontFamily: font.display,
                  fontSize: 17,
                  fontWeight: 800,
                  letterSpacing: "-.02em",
                  color: color.ink,
                }}
              >
                {s.label}
              </div>
              <div style={{ fontSize: 12, color: color.inkFaint }}>
                clip goes here
              </div>
            </div>
          ) : reduce ? (
            <img
              key={s.base}
              src={`${s.base}.jpg`}
              alt={s.label}
              onError={() => setFailed(true)}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />
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
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />
          )}
        </div>
      </div>
    </div>
  );

  const text = (
    <motion.div
      key={clipIndex}
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0 : 0.4, ease: [0.16, 1, 0.3, 1] }}
      style={{ textAlign: narrow ? "center" : "left" }}
    >
      <div
        style={{
          fontFamily: font.display,
          fontSize: 12.5,
          fontWeight: 800,
          letterSpacing: ".2em",
          textTransform: "lowercase",
          color: color.rust,
          marginBottom: 14,
        }}
      >{`SEE IT WORK · 0${clipIndex + 1}`}</div>
      <h2
        style={{
          margin: "0 0 16px",
          fontFamily: font.display,
          fontSize: "clamp(30px,4vw,50px)",
          fontWeight: 800,
          letterSpacing: "-.04em",
          lineHeight: 1,
          textTransform: "lowercase",
          color: color.ink,
        }}
      >
        {s.label}.
      </h2>
      <p
        style={{
          margin: 0,
          fontSize: "clamp(15px,1.6vw,18px)",
          lineHeight: 1.6,
          color: color.inkBody,
        }}
      >
        {s.caption}
      </p>
    </motion.div>
  );

  return (
    <div
      ref={sectionRef}
      style={{ position: "relative", height: `${N * STEP_VH}vh` }}
    >
      <div
        style={{
          position: "sticky",
          top: 0,
          height: "100vh",
          overflowX: "clip",
          overflowY: "visible",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: `${NAV_SAFE}px ${gutter}px 0`,
          boxSizing: "border-box",
        }}
      >
        {narrow ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: STACK_GAP,
              maxWidth: 440,
            }}
          >
            {phone}
            {/* stable wrapper: `text` remounts per clip, so the observer sits here */}
            <div ref={textRef} style={{ width: "100%" }}>
              {text}
            </div>
          </div>
        ) : (
          <motion.div
            style={{
              display: "flex",
              flexDirection: phoneLeft ? "row" : "row-reverse",
              alignItems: "center",
              justifyContent: "center",
              gap: "clamp(30px,6vw,110px)",
              width: "100%",
              maxWidth: layout.pageMax,
            }}
          >
            <motion.div layout transition={swap} style={{ flexShrink: 0 }}>
              {phone}
            </motion.div>
            <motion.div
              layout
              transition={swap}
              style={{ width: "min(420px, 40%)", flexShrink: 0 }}
            >
              {text}
            </motion.div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
