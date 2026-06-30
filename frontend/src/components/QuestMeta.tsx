import { Clock, MapPin } from "lucide-react";
import { DifficultyBadge } from "./DifficultyBadge";
import { CategoryChip } from "./CategoryChip";
import { formatMinutes, formatMiles } from "../lib/format";
import type { Quest } from "../types";

/** Difficulty pill + time + optional distance, with category chips below. */
export function QuestMeta({
  quest,
  size = "md",
}: {
  quest: Quest;
  size?: "sm" | "md";
}) {
  const miles = formatMiles(quest.locationInformation?.distanceMiles);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-footnote text-muted-foreground">
        <DifficultyBadge difficulty={quest.difficulty} />
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          {formatMinutes(quest.estimatedActivityMinutes)}
        </span>
        {quest.locationInformation && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            {miles ?? quest.locationInformation.name}
          </span>
        )}
      </div>
      {size === "md" && quest.categories.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {quest.categories.slice(0, 4).map((c) => (
            <CategoryChip key={c} label={c} />
          ))}
        </div>
      )}
    </div>
  );
}
