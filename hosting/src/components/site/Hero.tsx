import { useState, type ComponentProps } from "react";
import { motion, useReducedMotion, type Variants } from "motion/react";
import { color, font, layout } from "@/lib/tokens";
import { useViewportWidth } from "@/lib/useViewport";
import SiteHeader from "./SiteHeader";
import { HeroBackground } from "./HeroBackground";
import { PolaroidCard } from "./PolaroidCard";
import { WaitlistCTA } from "./WaitlistCTA";
import { TextEffect } from "@/components/ui/text-effect";

/* Blur-clear drift-up (heroes 17/43): each element rises and unblurs on a spring. */
const leftGroup: Variants = { hidden: {}, visible: { transition: { staggerChildren: 0.1, delayChildren: 0.12 } } };
const rise: Variants = {
  hidden: { opacity: 0, y: 22, filter: "blur(8px)" },
  visible: { opacity: 1, y: 0, filter: "blur(0px)", transition: { type: "spring", damping: 26, stiffness: 72 } },
};

type CardProps = ComponentProps<typeof PolaroidCard>;

/**
 * A polaroid that assembles itself: the photo drops/fades in first, then the
 * orange tape presses on over the top edge — and then it stays put. Click it and
 * the tape peels off, the photo tumbles down under gravity and vanishes (a little
 * easter egg). Reduced motion collapses all of this to fades.
 */
function TapedPolaroid({ left, top, delay, dir, card }: { left: number; top: number; delay: number; dir: number; card: CardProps }) {
  const reduce = useReducedMotion() ?? false;
  const [phase, setPhase] = useState<"in" | "falling" | "gone">("in");
  if (phase === "gone") return null;
  const falling = phase === "falling";

  return (
    <motion.div
      style={{ position: "absolute", left, top, cursor: "pointer" }}
      onClick={() => phase === "in" && setPhase("falling")}
      animate={falling ? { x: dir * 48, y: 840, rotate: card.rotation + dir * 82, opacity: 0 } : { x: 0, y: 0, rotate: 0, opacity: 1 }}
      transition={falling ? { duration: reduce ? 0.3 : 0.92, delay: reduce ? 0 : 0.14, ease: [0.4, 0, 1, 1] } : { duration: 0 }}
      onAnimationComplete={() => {
        if (falling) setPhase("gone");
      }}
    >
      {/* the photo lands first */}
      <motion.div
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: -38, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={reduce ? { duration: 0.3, delay } : { type: "spring", stiffness: 130, damping: 15, delay }}
      >
        <div style={{ position: "relative" }}>
          <PolaroidCard {...card} tape={false} />
          {/* the tape presses on after the photo settles; peels off on click */}
          <motion.div
            aria-hidden
            style={{
              position: "absolute",
              top: -12,
              left: "calc(50% - 38px)",
              width: 76,
              height: 24,
              background: "linear-gradient(180deg, rgba(255,190,157,.74), rgba(255,171,133,.6))",
              border: "1px solid rgba(38,34,27,.08)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,.42), 0 2px 5px -1px rgba(38,34,27,.16)",
              transformOrigin: "50% 0%",
            }}
            initial={reduce ? { opacity: 0, rotate: card.tapeRotation } : { opacity: 0, scaleY: 0.12, rotate: card.tapeRotation }}
            animate={
              falling
                ? { opacity: 0, y: -48, x: dir * 24, rotate: card.tapeRotation - 46 }
                : { opacity: 1, scaleY: 1, y: 0, rotate: card.tapeRotation }
            }
            transition={
              falling
                ? { duration: 0.32, ease: "easeOut" }
                : reduce
                  ? { duration: 0.3, delay: delay + 0.25 }
                  : { type: "spring", stiffness: 320, damping: 18, delay: delay + 0.42 }
            }
          />
        </div>
      </motion.div>
    </motion.div>
  );
}

/** The two taped polaroids on their 560×430 stage — floated over the hero on
 *  desktop, dropped in below the copy on narrow screens. */
function PolaroidStage({ scale, origin }: { scale: number; origin: string }) {
  return (
    <div style={{ width: 560 * scale, height: 430 * scale }}>
      <div style={{ position: "relative", height: 430, width: 560, transform: `scale(${scale})`, transformOrigin: origin }}>
        <TapedPolaroid
          dir={-1}
          left={0}
          top={0}
          delay={0.25}
          card={{ width: 250, rotation: -4, tapeRotation: 2, chin: 44, wellHeight: 190, wellLabel: "Photo — counter seat", caption: "table for one, 8.15pm" }}
        />
        <TapedPolaroid
          dir={1}
          left={290}
          top={132}
          delay={0.55}
          card={{ width: 270, rotation: 3.5, tapeRotation: -3, chin: 40, wellHeight: 170, wellLabel: "Photo — cold water, 07:00", caption: "13°C. did it anyway." }}
        />
      </div>
    </div>
  );
}

export default function Hero() {
  const w = useViewportWidth();
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
              color: color.white,
              textWrap: "pretty",
            }}
          >
            Do the thing you keep going around.
          </TextEffect>

          {/* Paragraph */}
          <motion.p variants={rise} style={{ margin: "0 0 28px", fontSize: "clamp(15.5px,1.6vw,17px)", lineHeight: 1.6, maxWidth: 420, color: color.white }}>
            Tell it what you avoid. It hands back one small quest — a real place, close enough to walk to tonight.
          </motion.p>

          {/* Waitlist CTA */}
          <motion.div variants={rise}>
            <WaitlistCTA id="get" dark />
          </motion.div>

          {/* Handwritten aside */}
          <motion.div
            variants={rise}
            style={{
              fontFamily: font.hand,
              fontSize: 21,
              lineHeight: 1.35,
              color: "#F4E7D6", // warm cream — the aside sits over the dark foreground
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
              <PolaroidStage scale={polScale} origin="top center" />
            </div>
          )}
        </motion.div>

        {/* Desktop: the polaroids float in the space to the right, one viewport. */}
        {!narrow && (
          <div style={{ position: "absolute", right: layout.gutter, top: "50%", transform: "translateY(-50%)" }}>
            <PolaroidStage scale={polScale} origin="center right" />
          </div>
        )}
      </div>
    </section>
  );
}
