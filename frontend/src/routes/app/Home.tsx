import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useShallow } from "zustand/react/shallow";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ListChecks,
  PenLine,
  RefreshCw,
  Shuffle,
  Sparkles,
} from "lucide-react";
import { Button } from "../../components/ui/Button";
import { HeroVisual } from "../../components/HeroVisual";
import { DifficultyBadge } from "../../components/DifficultyBadge";
import { CategoryChip } from "../../components/CategoryChip";
import { QuestMap } from "../../components/QuestMap";
import { CuratingState } from "../../components/CuratingState";
import { TRANSPORT_LABELS, formatMiles, formatMinutes } from "../../lib/format";
import { generateGetStartedSteps } from "../../lib/getStarted";
import {
  selectActiveQuest,
  selectCurated,
  useAppStore,
} from "../../store/useAppStore";
import type { Quest } from "../../types";

export default function Home() {
  const active = useAppStore(selectActiveQuest);
  const curated = useAppStore(useShallow(selectCurated));
  const generating = useAppStore((s) => s.generating);
  const error = useAppStore((s) => s.error);
  const profile = useAppStore((s) => s.profile);
  const generateBatch = useAppStore((s) => s.generateBatch);
  const clearError = useAppStore((s) => s.clearError);

  const triggered = useRef(false);

  // Auto-curate a fresh trio when there's nothing to show and nothing active.
  useEffect(() => {
    if (active || curated.length > 0) {
      triggered.current = false;
      return;
    }
    if (!generating && !error && profile && !triggered.current) {
      triggered.current = true;
      generateBatch().catch(() => {});
    }
  }, [active, curated.length, generating, error, profile, generateBatch]);

  if (active) return <ActiveQuest quest={active} />;

  if (generating) return <CuratingState />;

  if (error && curated.length === 0) {
    return (
      <Shell>
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-extreme/15 text-extreme">
            <AlertCircle className="h-7 w-7" />
          </div>
          <div>
            <p className="font-display text-title2 font-semibold text-foreground">
              Couldn't curate your quests
            </p>
            <p className="mt-1 max-w-sm text-muted-foreground">{error}</p>
          </div>
          <Button
            onClick={() => {
              clearError();
              triggered.current = false;
              generateBatch().catch(() => {});
            }}
          >
            <RefreshCw className="h-5 w-5" />
            Try again
          </Button>
        </div>
      </Shell>
    );
  }

  if (curated.length > 0) return <CuratedBrowser quests={curated} />;

  // Idle fallback (no profile, or before the auto-trigger fires).
  return (
    <Shell>
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/15 text-primary">
          <Sparkles className="h-8 w-8" />
        </div>
        <p className="font-display text-title1 text-foreground">Ready when you are</p>
        <Button size="lg" onClick={() => generateBatch().catch(() => {})}>
          <Sparkles className="h-5 w-5" />
          Curate my sidequests
        </Button>
      </div>
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* Curated browser — one focused card, tap through the trio.           */
/* ------------------------------------------------------------------ */

function CuratedBrowser({ quests }: { quests: Quest[] }) {
  const navigate = useNavigate();
  const acceptQuest = useAppStore((s) => s.acceptQuest);
  const generateBatch = useAppStore((s) => s.generateBatch);

  const [[index, dir], setState] = useState<[number, number]>([0, 0]);
  const i = Math.min(index, quests.length - 1);
  const quest = quests[i];

  const paginate = (delta: number) => {
    const next = (i + delta + quests.length) % quests.length;
    setState([next, delta]);
  };

  // Keyboard: ← / → to move through the trio.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") paginate(-1);
      if (e.key === "ArrowRight") paginate(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, quests.length]);

  const start = () => {
    acceptQuest(quest.id);
    // Home re-renders into the active-quest view.
  };

  const loc = quest.locationInformation;
  const miles = formatMiles(loc?.distanceMiles);

  return (
    <div className="mx-auto w-full max-w-xl px-6 py-8 sm:py-12">
      {/* Kicker */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2 text-footnote font-medium uppercase tracking-wide text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Curated for you
        </div>
        <button
          onClick={() => generateBatch().catch(() => {})}
          className="inline-flex items-center gap-1.5 text-footnote font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          New trio
        </button>
      </div>

      {/* Focused card */}
      <div className="relative overflow-hidden">
        <AnimatePresence initial={false} mode="wait" custom={dir}>
          <motion.div
            key={quest.id}
            custom={dir}
            initial={{ opacity: 0, x: dir * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -40 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="overflow-hidden rounded-4xl border border-border bg-surface shadow-card">
              <div className="relative aspect-[4/5] w-full sm:aspect-[3/2]">
                <HeroVisual
                  photoURL={loc?.photoURL}
                  placeholderIndex={quest.placeholderIndex}
                  alt={quest.title}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-6">
                  <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-footnote font-medium text-white/90">
                    <DifficultyBadge
                      difficulty={quest.difficulty}
                      className="border-white/25 bg-white/15 text-white"
                    />
                    <span>{formatMinutes(quest.estimatedActivityMinutes)}</span>
                    {miles && <span>· {miles}</span>}
                  </div>
                  <h1 className="font-display text-largetitle font-semibold leading-[1.05] text-white drop-shadow-sm">
                    {quest.title}
                  </h1>
                </div>
              </div>

              <div className="space-y-4 p-6">
                <p className="text-callout leading-relaxed text-foreground/90 line-clamp-4">
                  {quest.questDescription}
                </p>
                {quest.categories.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {quest.categories.slice(0, 4).map((c) => (
                      <CategoryChip key={c} label={c} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Pager */}
      <div className="mt-5 flex items-center justify-center gap-4">
        <button
          onClick={() => paginate(-1)}
          aria-label="Previous"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          {quests.map((q, idx) => (
            <button
              key={q.id}
              aria-label={`Go to quest ${idx + 1}`}
              onClick={() => setState([idx, idx > i ? 1 : -1])}
              className={`h-2 rounded-full transition-all ${
                idx === i ? "w-6 bg-primary" : "w-2 bg-border"
              }`}
            />
          ))}
        </div>
        <button
          onClick={() => paginate(1)}
          aria-label="Next"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowRight className="h-5 w-5" />
        </button>
      </div>

      {/* Primary action */}
      <Button size="lg" className="mt-7 w-full" onClick={start}>
        <CheckCircle2 className="h-5 w-5" />
        Start this quest
      </Button>

      {/* Describe your own */}
      <button
        onClick={() => navigate("/app/create")}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-3.5 text-subheadline font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
      >
        <PenLine className="h-4 w-4" />
        Or describe your own idea
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Active quest — the one committed adventure.                         */
/* ------------------------------------------------------------------ */

function ActiveQuest({ quest }: { quest: Quest }) {
  const navigate = useNavigate();
  const profile = useAppStore((s) => s.profile);
  const swapActive = useAppStore((s) => s.swapActive);
  const setGetStartedSteps = useAppStore((s) => s.setGetStartedSteps);

  const [open, setOpen] = useState(false);
  const [loadingGuide, setLoadingGuide] = useState(false);

  const loc = quest.locationInformation;
  const recommended = loc?.transportationOptions?.find((o) => o.isRecommended);

  const openGuide = () => {
    if (!quest.getStartedSteps) {
      setLoadingGuide(true);
      setTimeout(() => {
        setGetStartedSteps(quest.id, generateGetStartedSteps(quest, profile));
        setLoadingGuide(false);
        setOpen(true);
      }, 650);
    } else {
      setOpen((o) => !o);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-0 pb-10 sm:px-6 sm:py-8">
      {/* Hero */}
      <div className="relative h-72 w-full overflow-hidden sm:h-96 sm:rounded-4xl">
        <HeroVisual
          photoURL={loc?.photoURL}
          placeholderIndex={quest.placeholderIndex}
          alt={quest.title}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-6">
          <span className="mb-2.5 inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-footnote font-semibold text-primary-foreground">
            {quest.source === "described" ? (
              <>
                <PenLine className="h-3.5 w-3.5" />
                Your own idea
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" />
                Your active quest
              </>
            )}
          </span>
          <h1 className="font-display text-display font-semibold leading-[1.03] text-white drop-shadow-sm">
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
        <div className="overflow-hidden rounded-3xl border border-border bg-surface">
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
                {quest.getStartedSteps.map((s, idx) => (
                  <li key={idx} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-footnote font-bold text-primary">
                      {idx + 1}
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
            onClick={() => swapActive()}
          >
            <Shuffle className="h-5 w-5" />
            Back to picks
          </Button>
        </div>
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-8 sm:py-12">{children}</div>
  );
}
