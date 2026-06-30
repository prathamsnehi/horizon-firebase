import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  ChevronDown,
  Compass,
  ListChecks,
  Shuffle,
} from "lucide-react";
import { Button } from "../../components/ui/Button";
import { HeroVisual } from "../../components/HeroVisual";
import { DifficultyBadge } from "../../components/DifficultyBadge";
import { CategoryChip } from "../../components/CategoryChip";
import { QuestMap } from "../../components/QuestMap";
import {
  TRANSPORT_LABELS,
  formatMiles,
  formatMinutes,
} from "../../lib/format";
import { generateGetStartedSteps } from "../../lib/getStarted";
import { selectActiveQuest, useAppStore } from "../../store/useAppStore";

export default function Home() {
  const navigate = useNavigate();
  const quest = useAppStore(selectActiveQuest);
  const profile = useAppStore((s) => s.profile);
  const swapActive = useAppStore((s) => s.swapActive);
  const setGetStartedSteps = useAppStore((s) => s.setGetStartedSteps);

  const [open, setOpen] = useState(false);
  const [loadingGuide, setLoadingGuide] = useState(false);

  if (!quest) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-6 text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/15 text-primary">
          <Compass className="h-10 w-10" />
        </div>
        <h1 className="text-title1 font-bold tracking-tight text-foreground">
          Ready for your next adventure?
        </h1>
        <p className="mt-3 max-w-sm text-muted-foreground">
          You don't have an active quest yet. Head to Discover and swipe to
          choose the one that's calling you.
        </p>
        <Link to="/app/discover" className="mt-7">
          <Button size="lg">
            <Compass className="h-5 w-5" />
            Browse sidequests
          </Button>
        </Link>
      </div>
    );
  }

  const loc = quest.locationInformation;

  const openGuide = () => {
    if (!quest.getStartedSteps) {
      setLoadingGuide(true);
      // Mocked "generation" — brief delay for a real-feeling moment.
      setTimeout(() => {
        setGetStartedSteps(quest.id, generateGetStartedSteps(quest, profile));
        setLoadingGuide(false);
        setOpen(true);
      }, 650);
    } else {
      setOpen((o) => !o);
    }
  };

  const recommended = loc?.transportationOptions?.find((o) => o.isRecommended);

  return (
    <div className="mx-auto max-w-3xl px-0 pb-10 sm:px-6 sm:py-8">
      {/* Hero */}
      <div className="relative h-72 w-full overflow-hidden sm:h-96 sm:rounded-3xl">
        <HeroVisual
          photoURL={loc?.photoURL}
          placeholderIndex={quest.placeholderIndex}
          alt={quest.title}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-6">
          <span className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-footnote font-bold text-primary-foreground">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Your active quest
          </span>
          <h1 className="text-largetitle font-bold leading-tight text-white drop-shadow">
            {quest.title}
          </h1>
        </div>
      </div>

      <div className="space-y-7 px-6 pt-6 sm:px-0">
        {/* Metadata */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-subheadline text-muted-foreground">
          <DifficultyBadge difficulty={quest.difficulty} />
          <span>{formatMinutes(quest.estimatedActivityMinutes)}</span>
          {loc && formatMiles(loc.distanceMiles) && (
            <span>· {formatMiles(loc.distanceMiles)}</span>
          )}
          <div className="flex flex-wrap gap-1.5">
            {quest.categories.map((c) => (
              <CategoryChip key={c} label={c} />
            ))}
          </div>
        </div>

        {/* Description */}
        <p className="text-callout leading-relaxed text-foreground">
          {quest.questDescription}
        </p>

        {/* Get Started */}
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <button
            onClick={openGuide}
            className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
          >
            <span className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <ListChecks className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-headline font-semibold text-foreground">
                  Get started
                </span>
                <span className="block text-footnote text-muted-foreground">
                  {quest.getStartedSteps
                    ? "Your step-by-step plan"
                    : "Generate a step-by-step plan"}
                </span>
              </span>
            </span>
            {loadingGuide ? (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            ) : (
              <ChevronDown
                className={`h-5 w-5 text-muted-foreground transition-transform ${
                  open ? "rotate-180" : ""
                }`}
              />
            )}
          </button>
          <AnimatePresence initial={false}>
            {open && quest.getStartedSteps && (
              <motion.ol
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="space-y-3 px-5 pb-5"
              >
                {quest.getStartedSteps.map((s, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-footnote font-bold text-primary">
                      {i + 1}
                    </span>
                    <span className="text-callout leading-relaxed text-foreground">
                      {s}
                    </span>
                  </li>
                ))}
              </motion.ol>
            )}
          </AnimatePresence>
        </div>

        {/* Map + travel */}
        {loc && (
          <div className="space-y-3">
            <QuestMap location={loc} />
            <div className="flex flex-wrap items-center gap-2 text-footnote text-muted-foreground">
              <span className="font-medium text-foreground">{loc.address}</span>
              {recommended && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-0.5 font-semibold text-foreground">
                  {TRANSPORT_LABELS[recommended.mode]} ·{" "}
                  {formatMinutes(recommended.estimatedTravelMinutes)}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-3 pt-2 sm:flex-row">
          <Button
            size="lg"
            className="flex-1"
            onClick={() => navigate(`/app/complete/${quest.id}`)}
          >
            <CheckCircle2 className="h-5 w-5" />
            I did it
          </Button>
          <Button
            size="lg"
            variant="secondary"
            className="flex-1"
            onClick={() => {
              swapActive();
              navigate("/app/discover");
            }}
          >
            <Shuffle className="h-5 w-5" />
            Swap quest
          </Button>
        </div>
      </div>
    </div>
  );
}
