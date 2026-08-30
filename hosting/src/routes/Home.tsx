import { useEffect, useLayoutEffect } from "react";
import { MotionConfig } from "motion/react";
import { StickyHeader } from "../components/site/StickyHeader";
import { ScrollProgress } from "../components/site/ScrollProgress";
import Hero from "../components/site/Hero";
import Showcase from "../components/site/Showcase";
import CtaFooter from "../components/site/CtaFooter";
import { Grain } from "../components/ui/grain";
import { useSmoothScroll } from "../lib/useSmoothScroll";
import { trackPageview } from "../lib/analytics";
import { color, font } from "../lib/tokens";

/**
 * The public marketing site at `/`. Deliberately short: hook → live demo → CTA.
 * A showcase should make its point in seconds, so the page is three beats over
 * momentum smooth-scroll, with a progress bar and a film-grain overlay for feel.
 *
 * Nothing here (or anything it imports) may pull in Firebase — keeping this route
 * Firebase-free is what lets Vite split the admin bundle away from the page every
 * visitor sees.
 *
 * The site is light-themed; the admin dashboard is dark. We theme <body> to the
 * marketing palette only while this route is mounted and revert on unmount, so
 * `/admin` keeps its default dark theme (index.css) untouched.
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

  // Aggregate, anonymous counters only (see lib/analytics.ts). Runs once per
  // mount; StrictMode double-invokes effects in dev, not in the production build.
  useEffect(() => {
    trackPageview();
  }, []);

  useSmoothScroll();

  return (
    // reducedMotion="user" makes every motion animation on the marketing site
    // honour the visitor's OS "reduce motion" setting automatically.
    <MotionConfig reducedMotion="user">
      <div className="hz-site" id="top">
        <ScrollProgress />
        <StickyHeader />
        <Hero />
        <Showcase />
        <CtaFooter />
        <Grain />
      </div>
    </MotionConfig>
  );
}
