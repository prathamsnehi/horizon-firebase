import { cn } from "../../lib/cn";

export interface PillProps {
  selected?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  emoji?: string;
  as?: "button" | "span";
  className?: string;
}

/** Selectable chip used across onboarding and metadata rows. */
export function Pill({
  selected,
  onClick,
  children,
  emoji,
  as = "button",
  className,
}: PillProps) {
  const Comp = as;
  return (
    <Comp
      {...(as === "button" ? { type: "button" as const, onClick } : {})}
      aria-pressed={as === "button" ? !!selected : undefined}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-subheadline font-medium",
        "transition-all duration-150 select-none",
        as === "button" && "active:scale-95",
        selected
          ? "border-primary bg-primary/15 text-foreground ring-1 ring-primary/40"
          : "border-border bg-surface text-muted-foreground hover:border-primary/50 hover:text-foreground",
        className
      )}
    >
      {emoji && <span aria-hidden>{emoji}</span>}
      {children}
    </Comp>
  );
}
