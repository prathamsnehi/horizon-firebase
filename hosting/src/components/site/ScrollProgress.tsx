import { motion, useScroll, useSpring } from "motion/react";
import { color } from "@/lib/tokens";

/** A slim reading-progress bar pinned to the top of the marketing page. */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 30, mass: 0.3 });

  return (
    <motion.div
      aria-hidden
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        transformOrigin: "0% 50%",
        scaleX,
        background: `linear-gradient(90deg, ${color.peach}, ${color.rust})`,
        zIndex: 120,
      }}
    />
  );
}
