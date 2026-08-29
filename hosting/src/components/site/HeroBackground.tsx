import { motion, useScroll, useTransform, useReducedMotion } from "motion/react";

/**
 * The hero's backdrop — the dusk-skyline photo (public/hero-img.png). The image
 * drifts slower than the page as you scroll (subtle parallax) for depth; it's given
 * extra height so the drift never reveals an edge. No scrim or bottom fade — the
 * photo runs full-bleed for immersion, and legibility is carried by the text itself
 * (color + a soft halo in Hero.tsx). Parallax is disabled under reduced motion.
 */
export function HeroBackground() {
  const reduce = useReducedMotion();
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 800], [0, reduce ? 0 : 110]);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Instant warm placeholder so the hero reads as an intentional sunrise
          wash while the full image streams in on top (perceived performance). */}
      <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, #d9c8c3 0%, #f0c6a3 48%, #f9e7d3 78%, #fbf8f3 100%)" }} />
      <motion.div
        className="absolute left-0 right-0"
        style={{
          top: "-9%",
          height: "118%",
          y,
          backgroundImage: "url(/hero-img.png)",
          backgroundSize: "cover",
          backgroundPosition: "center center",
        }}
      />
    </div>
  );
}
