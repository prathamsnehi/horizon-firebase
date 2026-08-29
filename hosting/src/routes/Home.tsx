import { useLayoutEffect } from "react";
import { MotionConfig } from "motion/react";
import { StickyHeader } from "../components/site/StickyHeader";
import Hero from "../components/site/Hero";
import Showcase from "../components/site/Showcase";
import CtaFooter from "../components/site/CtaFooter";
import { color, font } from "../lib/tokens";

/**
 * The public marketing site at `/`. Three parts: hero, a pinned scroll story, and
 * a CTA + footer.
 *
 * Nothing here (or anything it imports) may pull in Firebase — keeping this route
 * Firebase-free is what lets Vite split the admin bundle away from the page every
 * visitor sees.
 *
 * The site is light-themed; the admin dashboard is dark. Rather than fight over a
 * global <body> style, we theme <body> to the marketing palette only while this
 * route is mounted and revert on unmount, so `/admin` keeps its default dark
 * theme (index.css) untouched.
 */
export default function Home() {
  useLayoutEffect(() => {
    const b = document.body;
    const prev = b.getAttribute("style");
    b.style.background = color.paper;
    b.style.color = color.ink;
    b.style.fontFamily = font.body;
    b.style.overflowX = "hidden";
    return () => {
      if (prev === null) b.removeAttribute("style");
      else b.setAttribute("style", prev);
    };
  }, []);

  return (
    // reducedMotion="user" makes every motion animation on the marketing site
    // honour the visitor's OS "reduce motion" setting automatically.
    <MotionConfig reducedMotion="user">
      <div className="hz-site" id="top">
        <StickyHeader />
        <Hero />
        <Showcase />
        <CtaFooter />
      </div>
    </MotionConfig>
  );
}
