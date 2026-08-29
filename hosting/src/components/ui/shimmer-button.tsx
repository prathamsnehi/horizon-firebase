import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Watermelon UI's shimmer button, adapted to Horizon's palette. A light sheen
 * sweeps across on hover. Colour is left to the caller (e.g. `bg-ink text-paper`).
 */
export function ShimmerButton({
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      className={cn(
        "group relative overflow-hidden px-6 py-3 font-semibold",
        "transition-[box-shadow,transform] duration-300 hover:-translate-y-0.5 active:translate-y-0",
        className
      )}
      {...props}
    >
      <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -translate-x-full bg-linear-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 group-hover:translate-x-full motion-reduce:hidden"
      />
    </button>
  );
}
