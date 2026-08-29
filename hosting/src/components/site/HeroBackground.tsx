import { motion, useScroll, useTransform, useReducedMotion } from "motion/react";

/**
 * The hero's backdrop — the dusk-skyline photo (public/hero/hero-img.webp). The image
 * drifts slower than the page as you scroll (subtle parallax) for depth; it's given
 * extra height so the drift never reveals an edge. The photo runs full-bleed for
 * immersion; a flat low-opacity black overlay sits on top of it to lift the white
 * hero copy's contrast without reintroducing a directional scrim/vignette.
 * Parallax is disabled under reduced motion.
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
          backgroundImage: "url(/hero/hero-img.webp)",
          backgroundSize: "cover",
          backgroundPosition: "center center",
        }}
      />
      {/* Accessibility: an even wash over the whole photo so the white copy keeps
          its contrast on the bright sky as well as the dark skyline. Flat (not a
          gradient) so it darkens the image without reading as a vignette. */}
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,.22)" }} />
    </div>
  );
}
