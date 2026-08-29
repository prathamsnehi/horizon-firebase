import { useRef, type ReactNode } from "react";
import { motion, useMotionValue, useSpring, useReducedMotion, type SpringOptions } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * 3D mouse-parallax tilt (motion-primitives pattern). Wraps children in a
 * perspective container and springs rotateX/rotateY toward the cursor position.
 * No-ops under prefers-reduced-motion.
 */
const DEFAULT_SPRING: SpringOptions = { stiffness: 260, damping: 20, mass: 0.6 };

export function Tilt({
  children,
  className,
  rotationFactor = 12,
  perspective = 1000,
  springOptions = DEFAULT_SPRING,
}: {
  children: ReactNode;
  className?: string;
  rotationFactor?: number;
  perspective?: number;
  springOptions?: SpringOptions;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  const rxTarget = useMotionValue(0);
  const ryTarget = useMotionValue(0);
  const rotateX = useSpring(rxTarget, springOptions);
  const rotateY = useSpring(ryTarget, springOptions);

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    if (reduce || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    rxTarget.set(-py * rotationFactor);
    ryTarget.set(px * rotationFactor);
  }

  function onLeave() {
    rxTarget.set(0);
    ryTarget.set(0);
  }

  return (
    <div ref={ref} onMouseMove={onMove} onMouseLeave={onLeave} style={{ perspective }} className={cn(className)}>
      <motion.div style={{ transformStyle: "preserve-3d", rotateX, rotateY }}>{children}</motion.div>
    </div>
  );
}
