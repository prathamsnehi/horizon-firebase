import { motion, useReducedMotion } from "motion/react";
import { Link } from "react-router-dom";
import { color, font, layout } from "@/lib/tokens";
import { InView } from "@/components/ui/in-view";
import { DownloadCTA } from "./DownloadCTA";

const group = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
};
const rise = {
  hidden: { opacity: 0, y: 22, filter: "blur(8px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { type: "spring", damping: 26, stiffness: 72 },
  },
} as const;

export default function CtaFooter() {
  const reduce = useReducedMotion() ?? false;

  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        padding: `clamp(96px,14vw,168px) ${layout.gutter} clamp(72px,9vw,104px)`,
        textAlign: "center",
        background: color.paper,
      }}
    >
      {/* Breathing peach glow behind the wordmark */}
      <motion.div
        aria-hidden
        style={{
          position: "absolute",
          left: "50%",
          top: "42%",
          width: "78vmin",
          height: "78vmin",
          transform: "translate(-50%,-50%)",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(255,182,147,.5), rgba(255,182,147,0) 66%)",
          filter: "blur(34px)",
          pointerEvents: "none",
        }}
        animate={
          reduce
            ? undefined
            : { opacity: [0.6, 0.95, 0.6], scale: [0.98, 1.05, 0.98] }
        }
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      />

      <InView
        variants={group}
        className="relative"
        viewOptions={{ once: true, margin: "0px 0px -20% 0px" }}
      >
        <motion.div
          variants={rise}
          style={{
            fontFamily: font.display,
            fontSize: 12.5,
            fontWeight: 800,
            letterSpacing: ".22em",
            textTransform: "lowercase",
            color: color.rust,
            marginBottom: 26,
          }}
        >
          YOUR FIRST QUEST IS WAITING
        </motion.div>
        {/* The mark stands in for the word "Horizon" — "expand your ▲" — so it
              is sized to the cap height of one line and sits on the baseline like a
              letter. `sr-only` supplies the word it replaces for screen readers. */}
        <motion.h2
          variants={rise}
          style={{
            margin: "0 0 30px",
            fontFamily: font.condensed,
            fontSize: "clamp(34px,9vw,130px)",
            lineHeight: 0.84,
            fontWeight: 700,
            // textTransform: "lowercase",
            color: color.ink,
            letterSpacing: "-.01em",
          }}
        >
          expand your{" "}
          <span
            aria-hidden
            style={{
              display: "inline-block",
              width: "1.5em",
              height: "0.75em",
              background: color.peach,
              borderRadius: "999px 999px 0 0",
              verticalAlign: "baseline",
            }}
          />
          <span className="sr-only">Horizon</span>
        </motion.h2>
        <motion.div
          variants={rise}
          style={{ display: "flex", justifyContent: "center" }}
        >
          <DownloadCTA caption="Free to use · no accounts or login" />
        </motion.div>
      </InView>

      {/* Minimal legal line. App Store review requires a reachable privacy URL,
          and the copyright is the only other thing the page needs to carry. */}
      <div
        style={{
          position: "relative",
          marginTop: "clamp(56px,8vw,88px)",
          fontSize: 12.5,
          color: color.inkFaint,
        }}
      >
        <Link to="/privacy" style={{ color: color.inkFaint }}>
          Privacy
        </Link>
        <span style={{ margin: "0 10px" }}>·</span>© {new Date().getFullYear()}{" "}
        Horizon
      </div>
    </div>
  );
}
