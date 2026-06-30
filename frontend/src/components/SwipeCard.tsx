import {
  motion,
  useMotionValue,
  useTransform,
  type PanInfo,
} from "framer-motion";
import { Check, MapPin, X } from "lucide-react";
import { HeroVisual } from "./HeroVisual";
import { QuestMeta } from "./QuestMeta";
import type { Quest } from "../types";

const SWIPE_THRESHOLD = 120;

interface SwipeCardProps {
  quest: Quest;
  isTop: boolean;
  /** Stacking depth (0 = top). */
  depth: number;
  onSkip: () => void;
  onAccept: () => void;
}

export function SwipeCard({
  quest,
  isTop,
  depth,
  onSkip,
  onAccept,
}: SwipeCardProps) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-220, 220], [-12, 12]);
  const likeOpacity = useTransform(x, [40, 140], [0, 1]);
  const nopeOpacity = useTransform(x, [-140, -40], [1, 0]);

  function handleDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.x > SWIPE_THRESHOLD) onAccept();
    else if (info.offset.x < -SWIPE_THRESHOLD) onSkip();
  }

  return (
    <motion.div
      className="absolute inset-0"
      style={{
        x: isTop ? x : 0,
        rotate: isTop ? rotate : 0,
        zIndex: 50 - depth,
      }}
      initial={false}
      animate={{
        scale: 1 - depth * 0.04,
        y: depth * 14,
        opacity: depth > 2 ? 0 : 1,
      }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      drag={isTop ? "x" : false}
      dragSnapToOrigin
      dragElastic={0.6}
      onDragEnd={handleDragEnd}
      whileDrag={{ cursor: "grabbing" }}
    >
      <div className="flex h-full w-full flex-col overflow-hidden rounded-3xl border border-border bg-surface shadow-card-hover">
        {/* Hero ~60% */}
        <div className="relative h-[58%] w-full">
          <HeroVisual
            photoURL={quest.locationInformation?.photoURL}
            placeholderIndex={quest.placeholderIndex}
            alt={quest.title}
          />
          {quest.locationInformation && (
            <span className="absolute left-4 top-4 inline-flex items-center gap-1 rounded-full bg-black/45 px-2.5 py-1 text-footnote font-medium text-white backdrop-blur">
              <MapPin className="h-3.5 w-3.5" />
              {quest.locationInformation.name}
            </span>
          )}

          {/* Swipe indicators */}
          <motion.div
            style={{ opacity: likeOpacity }}
            className="absolute right-5 top-5 rotate-12 rounded-xl border-4 border-easy px-3 py-1 text-title3 font-extrabold uppercase text-easy"
          >
            Go
          </motion.div>
          <motion.div
            style={{ opacity: nopeOpacity }}
            className="absolute left-5 top-5 -rotate-12 rounded-xl border-4 border-extreme px-3 py-1 text-title3 font-extrabold uppercase text-extreme"
          >
            Skip
          </motion.div>
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col gap-3 p-5">
          <h3 className="text-title2 font-bold leading-tight text-foreground">
            {quest.title}
          </h3>
          <p className="line-clamp-3 text-subheadline text-muted-foreground">
            {quest.questDescription}
          </p>
          <div className="mt-auto">
            <QuestMeta quest={quest} />
          </div>
        </div>
      </div>

      {/* Decorative action hints only on top card (buttons live in parent) */}
      {isTop && (
        <div className="pointer-events-none absolute inset-x-0 -bottom-px flex justify-between px-6 opacity-0">
          <Check />
          <X />
        </div>
      )}
    </motion.div>
  );
}
