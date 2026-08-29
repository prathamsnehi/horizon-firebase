import type { ComponentProps } from "react";
import { motion, useReducedMotion, type Variants } from "motion/react";
import { color, font, layout } from "@/lib/tokens";
import { useViewportWidth } from "@/lib/useViewport";
import SiteHeader from "./SiteHeader";
import { HeroBackground } from "./HeroBackground";
import { PolaroidCard } from "./PolaroidCard";
import { WaitlistCTA } from "./WaitlistCTA";
import { TextEffect } from "@/components/ui/text-effect";
import { Tilt } from "@/components/ui/tilt";

/* Blur-clear drift-up (heroes 17/43): each element rises and unblurs on a spring. */
const leftGroup: Variants = { hidden: {}, visible: { transition: { staggerChildren: 0.1, delayChildren: 0.12 } } };
const rise: Variants = {
  hidden: { opacity: 0, y: 22, filter: "blur(8px)" },
  visible: { opacity: 1, y: 0, filter: "blur(0px)", transition: { type: "spring", damping: 26, stiffness: 72 } },
};

/* The polaroids slide/spin in with a blur-clear, then float (hero 21). */
const rightGroup: Variants = { hidden: {}, visible: { transition: { staggerChildren: 0.16, delayChildren: 0.5 } } };
const cardIn = (dir: number): Variants => ({
  hidden: { opacity: 0, x: dir * 44, rotate: dir * 5, filter: "blur(12px)" },
  visible: { opacity: 1, x: 0, rotate: 0, filter: "blur(0px)", transition: { type: "spring", damping: 24, stiffness: 90, mass: 0.9 } },
});

function FloatingPolaroid({
  dir,
  left,
  top,
  delay,
  reduce,
  card,
}: {
  dir: number;
  left: number;
  top: number;
  delay: number;
  reduce: boolean;
  card: ComponentProps<typeof PolaroidCard>;
}) {
  return (
    <motion.div variants={cardIn(dir)} style={{ position: "absolute", left, top }}>
      <motion.div
        animate={reduce ? undefined : { y: [0, -10, 0] }}
        transition={{ duration: 6.5, repeat: Infinity, ease: "easeInOut", delay }}
      >
        <Tilt rotationFactor={9}>
          <PolaroidCard {...card} />
        </Tilt>
      </motion.div>
    </motion.div>
  );
}

/** The two taped polaroids on their 560×430 stage — floated over the hero on
 *  desktop, dropped in below the copy on narrow screens. */
function PolaroidStage({ reduce, scale, origin }: { reduce: boolean; scale: number; origin: string }) {
  return (
    <motion.div
      variants={rightGroup}
      initial="hidden"
      animate="visible"
      style={{ width: 560 * scale, height: 430 * scale }}
    >
      <div style={{ position: "relative", height: 430, width: 560, transform: `scale(${scale})`, transformOrigin: origin }}>
        <FloatingPolaroid
          dir={-1}
          left={0}
          top={0}
          delay={0}
          reduce={reduce}
          card={{ width: 250, rotation: -4, tapeRotation: 2, chin: 44, wellHeight: 190, wellLabel: "Photo — counter seat", caption: "table for one, 8.15pm" }}
        />
        <FloatingPolaroid
          dir={1}
          left={290}
          top={132}
          delay={1.4}
          reduce={reduce}
          card={{ width: 270, rotation: 3.5, tapeRotation: -3, chin: 40, wellHeight: 170, wellLabel: "Photo — cold water, 07:00", caption: "13°C. did it anyway." }}
        />
      </div>
    </motion.div>
  );
}

export default function Hero() {
  const w = useViewportWidth();
  const reduce = useReducedMotion() ?? false;
  const narrow = w < 960;
  const tiny = w < 560;
  // Desktop: scale the stage to the space right of the copy. Mobile: fit the width.
  const polScale = narrow ? (tiny ? Math.max(0.52, (w - 40) / 560) : 0.72) : Math.min(0.94, Math.max(0.74, (w - 660) / 620));

  return (
    <section
      style={{
        position: "relative",
        minHeight: narrow ? "auto" : "100svh",
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      <HeroBackground />

      {/* Legibility scrim: paper dissolves in under the copy so the dark text stays
          readable over the image, while the vivid sky + flowers show through on the
          right behind the polaroids. Left-to-paper on desktop; top-to-paper on
          narrow, where the copy stacks above the polaroids. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          background: narrow
            ? "linear-gradient(180deg, rgba(251,248,243,.88) 0%, rgba(251,248,243,.68) 32%, rgba(251,248,243,.3) 50%, rgba(251,248,243,0) 64%)"
            : "linear-gradient(90deg, rgba(251,248,243,.95) 0%, rgba(251,248,243,.78) 20%, rgba(251,248,243,.52) 34%, rgba(251,248,243,.16) 48%, rgba(251,248,243,0) 60%)",
        }}
      />

      {/* Nav overlaps the hero so the background reads as one continuous image. */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 6 }}>
        <SiteHeader />
      </div>

      <div
        style={{
          position: "relative",
          zIndex: 1,
          minHeight: narrow ? "auto" : "100svh",
          maxWidth: layout.pageMax,
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          padding: `clamp(104px,15vh,168px) ${layout.gutter} clamp(48px,7vh,88px)`,
          boxSizing: "border-box",
        }}
      >
        {/* Left column — copy */}
        <motion.div variants={leftGroup} initial="hidden" animate="visible" style={{ flex: "1 1 520px", minWidth: 0, maxWidth: 560 }}>
          {/* Badge pill */}
          <motion.div variants={rise} style={{ marginBottom: 22 }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                border: "1px solid rgba(160,85,42,.28)",
                background: "rgba(255,182,147,.16)",
                color: color.rust,
                borderRadius: 999,
                padding: "6px 13px 6px 11px",
                fontSize: 12.5,
                fontWeight: 700,
                letterSpacing: ".02em",
              }}
            >
              <span style={{ width: 14, height: 7, background: color.peach, borderRadius: "14px 14px 0 0", display: "block" }} />
              Private beta · iOS
            </span>
          </motion.div>

          {/* Rule */}
          <motion.div variants={rise} style={{ width: 64, height: 2, background: color.ink, marginBottom: "clamp(18px,3vw,32px)" }} />

          {/* Headline — per-word blur-slide reveal */}
          <TextEffect
            as="h1"
            per="word"
            preset="blur-slide"
            delay={0.32}
            speed={0.06}
            duration={0.7}
            style={{
              margin: "0 0 22px",
              fontFamily: font.display,
              fontSize: "clamp(40px,6.4vw,64px)",
              lineHeight: 0.96,
              fontWeight: 800,
              letterSpacing: "-.038em",
              maxWidth: 560,
              color: color.ink,
              textWrap: "pretty",
            }}
          >
            Do the thing you keep going around.
          </TextEffect>

          {/* Paragraph */}
          <motion.p variants={rise} style={{ margin: "0 0 28px", fontSize: "clamp(15.5px,1.6vw,17px)", lineHeight: 1.6, maxWidth: 440, color: color.inkBody }}>
            Tell Horizon what you avoid. It hands back one quest at a real place, close enough to walk to before dinner. You go, it
            notices you arrived, and the next one sits further out.
          </motion.p>

          {/* Waitlist CTA */}
          <motion.div variants={rise}>
            <WaitlistCTA id="get" />
          </motion.div>

          {/* Handwritten aside */}
          <motion.div
            variants={rise}
            style={{
              fontFamily: font.hand,
              fontSize: 21,
              lineHeight: 1.35,
              color: color.inkHand,
              maxWidth: 330,
              marginTop: 22,
              transform: "rotate(-.8deg)",
            }}
          >
            the first quest is almost too easy on purpose — nobody starts at the deep end
          </motion.div>

          {/* Narrow screens: the polaroids drop in below the copy, still in-hero. */}
          {narrow && (
            <div style={{ marginTop: "clamp(40px,9vw,64px)", display: "flex", justifyContent: "center" }}>
              <PolaroidStage reduce={reduce} scale={polScale} origin="top center" />
            </div>
          )}
        </motion.div>

        {/* Desktop: the polaroids float in the space to the right, one viewport. */}
        {!narrow && (
          <div style={{ position: "absolute", right: layout.gutter, top: "50%", transform: "translateY(-50%)" }}>
            <PolaroidStage reduce={reduce} scale={polScale} origin="center right" />
          </div>
        )}
      </div>
    </section>
  );
}
