import { useRef, type ReactNode } from "react";
import { motion, useInView, type Variants, type Transition, type UseInViewOptions } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * Viewport-triggered reveal (motion-primitives pattern). Animates `variants`
 * from "hidden" to "visible" the first time the element scrolls into view. Pass
 * a container variant with `staggerChildren` + child `<motion.*>` for a stagger.
 */
const DEFAULT_VARIANTS: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

export function InView({
  children,
  variants = DEFAULT_VARIANTS,
  transition,
  viewOptions = { once: true, margin: "0px 0px -15% 0px" },
  className,
}: {
  children: ReactNode;
  variants?: Variants;
  transition?: Transition;
  viewOptions?: UseInViewOptions;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, viewOptions);
  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      variants={variants}
      transition={transition}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}
