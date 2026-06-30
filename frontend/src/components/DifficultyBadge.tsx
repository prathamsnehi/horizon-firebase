import { cn } from "../lib/cn";
import { titleCase } from "../lib/format";
import type { Difficulty } from "../types";

const styles: Record<Difficulty, string> = {
  easy: "bg-easy/15 text-easy border-easy/30",
  moderate: "bg-moderate/15 text-moderate border-moderate/30",
  hard: "bg-hard/15 text-hard border-hard/30",
  extreme: "bg-extreme/15 text-extreme border-extreme/30",
};

export function DifficultyBadge({
  difficulty,
  className,
}: {
  difficulty: Difficulty;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-footnote font-semibold",
        styles[difficulty],
        className
      )}
    >
      {titleCase(difficulty)}
    </span>
  );
}
