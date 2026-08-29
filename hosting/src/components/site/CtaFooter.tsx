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

const footLink: CSSProperties = { color: color.inkFaint, textDecoration: "none", fontSize: 13.5 };
const colHead: CSSProperties = { fontFamily: font.display, fontSize: 12, fontWeight: 800, letterSpacing: ".16em", color: color.rust, marginBottom: 14 };

export default function CtaFooter() {
  const reduce = useReducedMotion() ?? false;

  return (
    <>
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
            background: "radial-gradient(circle, rgba(255,182,147,.5), rgba(255,182,147,0) 66%)",
            filter: "blur(34px)",
            pointerEvents: "none",
          }}
          animate={reduce ? undefined : { opacity: [0.6, 0.95, 0.6], scale: [0.98, 1.05, 0.98] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        />

        <InView variants={group} className="relative" viewOptions={{ once: true, margin: "0px 0px -20% 0px" }}>
          <motion.div variants={rise} style={{ fontFamily: font.display, fontSize: 12.5, fontWeight: 800, letterSpacing: ".22em", color: color.rust, marginBottom: 26 }}>
            YOUR FIRST QUEST IS WAITING
          </motion.div>
          <motion.div variants={rise} style={{ width: 60, height: 30, background: color.peach, borderRadius: "60px 60px 0 0", margin: "0 auto 26px" }} />
          <motion.h2
            variants={rise}
            style={{
              margin: "0 0 30px",
              fontFamily: font.condensed,
              fontSize: "clamp(60px,15vw,132px)",
              lineHeight: 0.84,
              fontWeight: 700,
              textTransform: "uppercase",
              color: color.ink,
              letterSpacing: "-.01em",
            }}
          >
            One quest.
            <br />
            Today.
          </motion.h2>
          <motion.div variants={rise} style={{ display: "flex", justifyContent: "center" }}>
            <WaitlistCTA />
          </motion.div>
          <motion.div variants={rise} style={{ marginTop: 20, fontSize: 13.5, color: color.inkFaint }}>
            No account. No feed. No streaks. Just today's quest.
          </motion.div>
        </InView>
      </div>

      {/* Footer bar */}
      <footer
        style={{
          borderTop: "1px solid rgba(33,29,24,.1)",
          padding: `clamp(40px,5vw,56px) ${layout.gutter}`,
          background: color.paperWarm,
        }}
      >
        <div style={{ maxWidth: layout.pageMax, margin: "0 auto", display: "flex", flexWrap: "wrap", gap: "clamp(32px,6vw,80px)", justifyContent: "space-between" }}>
          <div style={{ maxWidth: 300 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 14 }}>
              <span style={{ width: 22, height: 11, background: color.peach, borderRadius: "22px 22px 0 0", display: "block" }} />
              <span style={{ fontFamily: font.display, fontWeight: 800, fontSize: 18, letterSpacing: "-.01em", color: color.ink }}>Horizon</span>
            </div>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: color.inkFaint }}>
              Do the thing you keep going around. One small quest at a real place near you — iOS, private beta.
            </p>
          </div>

          <div style={{ display: "flex", gap: "clamp(40px,7vw,88px)", flexWrap: "wrap" }}>
            <div>
              <div style={colHead}>PRODUCT</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <a href="#steps" style={footLink}>See it work</a>
                <a href="#get" style={footLink}>Join the waitlist</a>
              </div>
            </div>
            <div>
              <div style={colHead}>COMPANY</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {/* TODO(founder): point these at real Safety/Privacy pages + a contact address. */}
                <a href="#get" style={footLink}>Safety</a>
                <a href="#get" style={footLink}>Privacy</a>
                <a href="#get" style={footLink}>Contact</a>
              </div>
            </div>
          </div>
        </div>

        <div style={{ maxWidth: layout.pageMax, margin: "clamp(32px,5vw,48px) auto 0", paddingTop: 20, borderTop: "1px solid rgba(33,29,24,.08)", fontSize: 12.5, color: color.inkFaint }}>
          Horizon, 2026 · Made for the things worth doing.
        </div>
      </footer>
    </>
  );
}
