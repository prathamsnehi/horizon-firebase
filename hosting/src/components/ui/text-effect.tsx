import type { CSSProperties } from "react";
import { motion, useReducedMotion, type Variants } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * Per-word / per-character staggered text reveal (motion-primitives pattern).
 * Collapses to an instant show under prefers-reduced-motion. Whitespace tokens
 * are preserved so wrapping and spacing stay natural.
 */
type Preset = "fade" | "slide" | "blur-slide";

const PRESETS: Record<Preset, Variants> = {
  fade: { hidden: { opacity: 0 }, visible: { opacity: 1 } },
  slide: { hidden: { opacity: 0, y: "0.35em" }, visible: { opacity: 1, y: 0 } },
  "blur-slide": {
    hidden: { opacity: 0, y: "0.4em", filter: "blur(6px)" },
    visible: { opacity: 1, y: 0, filter: "blur(0px)" },
  },
};

type Tag = "h1" | "h2" | "h3" | "p" | "span";

export function TextEffect({
  children,
  per = "word",
  preset = "blur-slide",
  as = "p",
  className,
  style,
  delay = 0,
  speed = 0.055,
  duration = 0.6,
}: {
  children: string;
  per?: "word" | "char";
  preset?: Preset;
  as?: Tag;
  className?: string;
  style?: CSSProperties;
  delay?: number;
  speed?: number;
  duration?: number;
}) {
  const reduce = useReducedMotion();
  const units = per === "word" ? children.split(/(\s+)/) : Array.from(children);

  const container: Variants = {
    hidden: {},
    visible: { transition: { staggerChildren: reduce ? 0 : speed, delayChildren: delay } },
  };
  const item = PRESETS[preset];

  // motion.<tag> — typed loosely because the tag is dynamic.
  const MotionTag = motion[as] as typeof motion.p;

  return (
    <MotionTag
      className={cn(className)}
      style={style}
      initial="hidden"
      animate="visible"
      variants={container}
      aria-label={children}
    >
      {units.map((u, i) =>
        u.trim() === "" ? (
          <span key={i}>{u}</span>
        ) : (
          <motion.span
            key={i}
            aria-hidden
            variants={item}
            transition={{ duration: reduce ? 0 : duration, ease: [0.16, 1, 0.3, 1] }}
            style={{ display: "inline-block", willChange: "transform, filter, opacity" }}
          >
            {u}
          </motion.span>
        )
      )}
    </MotionTag>
  );
}
