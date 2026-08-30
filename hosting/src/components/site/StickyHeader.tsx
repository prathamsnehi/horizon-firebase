import { useState } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import { color, font, layout } from "@/lib/tokens";
import { Magnetic } from "@/components/ui/magnetic";
import { DOWNLOAD_URL } from "@/lib/links";

/**
 * A compact bar that slides in once the hero has scrolled away, keeping a
 * download CTA always within reach (conversion). Hidden at the very top
 * so the hero reads clean. Light + translucent so it works over both the light
 * sections and the dark scroll story.
 */
export function StickyHeader() {
  const { scrollY } = useScroll();
  const [show, setShow] = useState(false);
  useMotionValueEvent(scrollY, "change", (y) => setShow(y > 560));

  return (
    <AnimatePresence>
      {show && (
        <motion.header
          initial={{ y: -72, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -72, opacity: 0 }}
          transition={{ type: "spring", damping: 24, stiffness: 280 }}
          className="fixed inset-x-0 top-0 z-50"
          style={{
            background: "rgba(251,248,243,.82)",
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
            borderBottom: "1px solid rgba(33,29,24,.08)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              padding: `11px ${layout.gutter}`,
              maxWidth: layout.pageMax,
              margin: "0 auto",
            }}
          >
            <a href="#top" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
              <span style={{ width: 20, height: 10, background: color.peach, borderRadius: "20px 20px 0 0", display: "block" }} />
              <span style={{ fontFamily: font.display, fontWeight: 800, fontSize: 16, letterSpacing: "-.01em", textTransform: "lowercase", color: color.ink }}>Horizon</span>
            </a>
            <Magnetic strength={0.25}>
              <motion.a
                href={DOWNLOAD_URL}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.97 }}
                style={{
                  fontFamily: font.display,
                  fontSize: 13.5,
                  fontWeight: 700,
                  color: color.paper,
                  background: color.ink,
                  padding: "8px 16px",
                  borderRadius: 8,
                  textTransform: "lowercase",
                  textDecoration: "none",
                }}
              >
                Download
              </motion.a>
            </Magnetic>
          </div>
        </motion.header>
      )}
    </AnimatePresence>
  );
}
