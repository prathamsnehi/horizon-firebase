import { useEffect, useState } from "react";

/** Current viewport width, updated on resize. Used for the hero's polaroid scale
 *  (the scroll story tracks its own w/h inside the rAF loop). */
export function useViewportWidth(): number {
  const [w, setW] = useState(() => (typeof window !== "undefined" ? window.innerWidth : 1200));
  useEffect(() => {
    const on = () => setW(window.innerWidth);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return w;
}
