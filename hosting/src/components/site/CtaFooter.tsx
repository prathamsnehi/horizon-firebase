import type { CSSProperties } from "react";
import { motion, useReducedMotion } from "motion/react";
import { color, font, layout } from "@/lib/tokens";
import { InView } from "@/components/ui/in-view";
import { WaitlistCTA } from "./WaitlistCTA";

const group = { hidden: {}, visible: { transition: { staggerChildren: 0.12 } } };
const rise = {
  hidden: { opacity: 0, y: 22, filter: "blur(8px)" },
  visible: { opacity: 1, y: 0, filter: "blur(0px)", transition: { type: "spring", damping: 26, stiffness: 72 } },
} as const;

const footLink: CSSProperties = { color: color.inkFaint, textDecoration: "none" };

export default function CtaFooter() {
  const reduce = useReducedMotion() ?? false;

  return (
    <>
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          padding: `clamp(72px,11vw,132px) ${layout.gutter} 64px`,
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
            top: "34%",
            width: "72vmin",
            height: "72vmin",
            transform: "translate(-50%,-50%)",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(255,182,147,.5), rgba(255,182,147,0) 66%)",
            filter: "blur(32px)",
            pointerEvents: "none",
          }}
          animate={reduce ? undefined : { opacity: [0.6, 0.95, 0.6], scale: [0.98, 1.05, 0.98] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        />

        <InView variants={group} className="relative" viewOptions={{ once: true, margin: "0px 0px -20% 0px" }}>
          <motion.div variants={rise} style={{ width: 56, height: 28, background: color.peach, borderRadius: "56px 56px 0 0", margin: "0 auto 24px" }} />
          <motion.h2
            variants={rise}
            style={{
              margin: "0 0 28px",
              fontFamily: font.condensed,
              fontSize: "clamp(56px,13vw,104px)",
              lineHeight: 0.86,
              fontWeight: 700,
              textTransform: "uppercase",
              color: color.ink,
            }}
          >
            One quest. Today.
          </motion.h2>
          <motion.div variants={rise} style={{ display: "flex", justifyContent: "center" }}>
            <WaitlistCTA />
          </motion.div>
          <motion.div variants={rise} style={{ marginTop: 20, fontSize: 13.5, color: color.inkFaint }}>
            No account. No feed. No streaks. Just today’s quest.
          </motion.div>
        </InView>
      </div>

      {/* Footer bar */}
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
          {/* TODO(founder): point these at real Safety/Privacy pages + a contact address. */}
          <a href="#get" style={footLink}>
            Safety
          </a>
          <a href="#get" style={footLink}>
            Privacy
          </a>
          <a href="#get" style={footLink}>
            Contact
          </a>
        </span>
      </div>
    </>
  );
}
