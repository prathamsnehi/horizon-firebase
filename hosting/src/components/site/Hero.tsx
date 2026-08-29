import { useState, type ComponentProps } from "react";
import { motion, useReducedMotion, type Variants } from "motion/react";
import { color, font, layout } from "@/lib/tokens";
import { useViewportWidth } from "@/lib/useViewport";
import SiteHeader from "./SiteHeader";
import { HeroBackground } from "./HeroBackground";
import { PolaroidCard } from "./PolaroidCard";
import { TextEffect } from "@/components/ui/text-effect";
import { DOWNLOAD_URL } from "@/lib/links";

/* Blur-clear drift-up (heroes 17/43): each element rises and unblurs on a spring. */
const leftGroup: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.12 } },
};
const rise: Variants = {
  hidden: { opacity: 0, y: 22, filter: "blur(8px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { type: "spring", damping: 26, stiffness: 72 },
  },
};

type CardProps = ComponentProps<typeof PolaroidCard>;

/** The Apple wordmark logo, inline (icon sets like Heroicons/lucide omit brand
 *  logos, so the canonical path is inlined here). Inherits `currentColor`. */
function AppleLogo({ size = 20 }: { size?: number }) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 384 512"
      fill="currentColor"
      focusable="false"
    >
      <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
    </svg>
  );
}

/**
 * A polaroid that assembles itself: the photo drops/fades in first, then the
 * orange tape presses on over the top edge — and then it stays put. Click it and
 * the tape peels off, the photo tumbles down under gravity and vanishes (a little
 * easter egg). Reduced motion collapses all of this to fades.
 */
function TapedPolaroid({
  left,
  top,
  delay,
  dir,
  card,
}: {
  left: number;
  top: number;
  delay: number;
  dir: number;
  card: CardProps;
}) {
  const reduce = useReducedMotion() ?? false;
  const [phase, setPhase] = useState<"in" | "falling" | "gone">("in");
  if (phase === "gone") return null;
  const falling = phase === "falling";

  return (
    <motion.div
      style={{ position: "absolute", left, top, cursor: "pointer" }}
      onClick={() => phase === "in" && setPhase("falling")}
      animate={
        falling
          ? {
              x: dir * 48,
              y: 840,
              rotate: card.rotation + dir * 82,
              opacity: 0,
            }
          : { x: 0, y: 0, rotate: 0, opacity: 1 }
      }
      transition={
        falling
          ? {
              duration: reduce ? 0.3 : 0.92,
              delay: reduce ? 0 : 0.14,
              ease: [0.4, 0, 1, 1],
            }
          : { duration: 0 }
      }
      onAnimationComplete={() => {
        if (falling) setPhase("gone");
      }}
    >
      {/* the photo lands first */}
      <motion.div
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: -38, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={
          reduce
            ? { duration: 0.3, delay }
            : { type: "spring", stiffness: 130, damping: 15, delay }
        }
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
              background:
                "linear-gradient(180deg, rgba(255,190,157,.74), rgba(255,171,133,.6))",
              border: "1px solid rgba(38,34,27,.08)",
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,.42), 0 2px 5px -1px rgba(38,34,27,.16)",
              transformOrigin: "50% 0%",
            }}
            initial={
              reduce
                ? { opacity: 0, rotate: card.tapeRotation }
                : { opacity: 0, scaleY: 0.12, rotate: card.tapeRotation }
            }
            animate={
              falling
                ? {
                    opacity: 0,
                    y: -48,
                    x: dir * 24,
                    rotate: card.tapeRotation - 46,
                  }
                : { opacity: 1, scaleY: 1, y: 0, rotate: card.tapeRotation }
            }
            transition={
              falling
                ? { duration: 0.32, ease: "easeOut" }
                : reduce
                  ? { duration: 0.3, delay: delay + 0.25 }
                  : {
                      type: "spring",
                      stiffness: 320,
                      damping: 18,
                      delay: delay + 0.42,
                    }
            }
          />
        </div>
      </motion.div>
    </motion.div>
  );
}

/** The two taped polaroids on their 560×470 stage — floated over the hero on
 *  desktop, dropped in below the copy on narrow screens. The stage box is sized
 *  to contain both cards at their square-well height. */
function PolaroidStage({ scale }: { scale: number }) {
  return (
    <div style={{ width: 560 * scale, height: 470 * scale }}>
      {/* Scale from the top-left corner so the shrunk cards line up exactly with
          their (already-scaled) box — any other origin lets them overflow the box
          and run off-screen, worse the smaller the viewport. */}
      <div
        style={{
          position: "relative",
          height: 470,
          width: 560,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        <TapedPolaroid
          dir={-1}
          left={0}
          top={0}
          delay={0.25}
          card={{
            width: 250,
            rotation: -4,
            tapeRotation: 2,
            chin: 44,
            wellLabel: "Photo — counter seat",
            caption: "Table for one, my first time eating out alone",
            photo: "/hero/hero-polaroid-1.webp",
          }}
        />
        <TapedPolaroid
          dir={1}
          left={290}
          top={120}
          delay={0.55}
          card={{
            width: 270,
            rotation: 3.5,
            tapeRotation: -3,
            chin: 40,
            wellLabel: "Photo - doing something for the first time",
            caption: "Thought I'd embarass myself, tried it anyway",
            photo: "/hero/hero-polaroid-2.webp",
          }}
        />
      </div>
    </div>
  );
}

export default function Hero() {
  const w = useViewportWidth();
  const narrow = w < 960;
  const tiny = w < 560;
  // Desktop: size the stage to the room left beside the fixed 560px copy column.
  // Derived from the no-overlap geometry: gutter(48)*2 + copy(560) + stage(560*s)
  // + 24px gap ≤ w  ⇒  s ≤ (w-680)/560. So cards reach full size once there's
  // room (~1280px+) and shrink just enough to never touch the copy below that.
  const polScale = narrow
    ? tiny
      ? Math.max(0.52, (w - 40) / 560)
      : 0.72
    : Math.min(1.0, Math.max(0.5, (w - 680) / 560));

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
      <div
        style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 6 }}
      >
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
        <motion.div
          variants={leftGroup}
          initial="hidden"
          animate="visible"
          style={{ flex: "1 1 520px", minWidth: 0, maxWidth: 560 }}
        >
          {/* Badge pill */}
          <motion.div variants={rise} style={{ marginBottom: 22 }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                border: "1px solid rgba(255,255,255,.32)",
                background: "rgba(255,255,255,.1)",
                color: "rgba(255,255,255,.85)",
                borderRadius: 999,
                padding: "6px 13px 6px 11px",
                fontSize: 12.5,
                fontWeight: 800,
                letterSpacing: ".02em",
              }}
            >
              <span
                style={{
                  width: 14,
                  height: 7,
                  background: color.peach,
                  borderRadius: "14px 14px 0 0",
                  display: "block",
                }}
              />
              Private beta · iOS
            </span>
          </motion.div>

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
              fontSize: "clamp(38px,5.8vw,58px)",
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
          <motion.p
            variants={rise}
            style={{
              margin: "0 0 28px",
              fontSize: "clamp(15.5px,1.6vw,17px)",
              lineHeight: 1.6,
              maxWidth: 420,
              color: color.white,
              fontWeight: 500,
            }}
          >
            Tell it what you avoid. It hands back one small quest — a real
            place, close enough to walk to tonight.
          </motion.p>

          {/* Download CTA */}
          <motion.div variants={rise} id="get">
            <motion.a
              href={DOWNLOAD_URL}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                background: color.peach,
                color: color.white,
                fontFamily: font.display,
                fontWeight: 800,
                fontSize: 16,
                padding: "14px 24px",
                borderRadius: 12,
                textDecoration: "none",
                boxShadow: "0 18px 34px -18px rgba(160,85,42,.8)",
              }}
            >
              <AppleLogo size={19} />
              Download for iOS
            </motion.a>
            <p
              style={{
                marginTop: 12,
                fontSize: 13,
                fontWeight: 500,
                color: "rgba(255,255,255,.7)",
              }}
            >
              Free · iOS first · no feed, ever.
            </p>
          </motion.div>

          {/* Narrow screens: the polaroids drop in below the copy, still in-hero. */}
          {narrow && (
            <div
              style={{
                marginTop: "clamp(40px,9vw,64px)",
                display: "flex",
                justifyContent: "center",
              }}
            >
              <PolaroidStage scale={polScale} />
            </div>
          )}
        </motion.div>

        {/* Desktop: the polaroids float in the space to the right, one viewport. */}
        {!narrow && (
          <div
            style={{
              position: "absolute",
              right: layout.gutter,
              top: "50%",
              transform: "translateY(-50%)",
            }}
          >
            <PolaroidStage scale={polScale} />
          </div>
        )}
      </div>
    </section>
  );
}
