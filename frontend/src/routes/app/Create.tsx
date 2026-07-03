import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  CheckCircle2,
  PenLine,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { Button } from "../../components/ui/Button";
import { HeroVisual } from "../../components/HeroVisual";
import { DifficultyBadge } from "../../components/DifficultyBadge";
import { CategoryChip } from "../../components/CategoryChip";
import { generateUserDescribedSidequest, ApiError } from "../../lib/api";
import { formatMiles, formatMinutes } from "../../lib/format";
import { placeholderIndexFor } from "../../data/placeholders";
import { useAppStore } from "../../store/useAppStore";
import type { SidequestItem } from "../../types";

const SUGGESTIONS = [
  "A slow, cozy morning somewhere new",
  "Something a little adventurous outdoors",
  "Meet people who share an interest of mine",
  "A creative challenge I can do tonight",
];

export default function Create() {
  const navigate = useNavigate();
  const profile = useAppStore((s) => s.profile);
  const acceptDescribed = useAppStore((s) => s.acceptDescribed);

  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">(
    "idle"
  );
  const [result, setResult] = useState<SidequestItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    const trimmed = prompt.trim();
    if (!trimmed || !profile) return;
    setStatus("loading");
    setError(null);
    try {
      const item = await generateUserDescribedSidequest(trimmed, profile);
      setResult(item);
      setStatus("done");
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : "We couldn't craft that one. Try rephrasing your idea."
      );
      setStatus("error");
    }
  };

  const startQuest = () => {
    if (!result) return;
    acceptDescribed(result);
    navigate("/app/home");
  };

  const reset = () => {
    setResult(null);
    setStatus("idle");
    setError(null);
  };

  return (
    <div className="mx-auto w-full max-w-xl px-6 py-10 sm:py-16">
      {status === "loading" && (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
          <div className="relative flex h-24 w-24 items-center justify-center">
            <motion.span
              className="absolute inset-0 rounded-full border-2 border-primary/30"
              animate={{ scale: [1, 1.35, 1], opacity: [0.6, 0, 0.6] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
            />
            <motion.div
              className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-primary"
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            >
              <PenLine className="h-7 w-7" />
            </motion.div>
          </div>
          <div>
            <p className="font-display text-title2 font-semibold text-foreground">
              Crafting your sidequest…
            </p>
            <p className="mt-2 text-muted-foreground">
              Shaping your idea into a real, doable quest.
            </p>
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">
        {status !== "loading" && (
          <motion.div
            key={status === "done" ? "result" : "compose"}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
          >
            {status === "done" && result ? (
              <ResultView
                item={result}
                onStart={startQuest}
                onRetry={reset}
              />
            ) : (
              <div>
                {/* Kicker */}
                <div className="mb-4 flex items-center gap-2 text-footnote font-medium uppercase tracking-wide text-muted-foreground">
                  <PenLine className="h-3.5 w-3.5 text-primary" />
                  Describe your own
                </div>
                <h1 className="font-display text-display font-semibold leading-[1.05] tracking-tight text-foreground">
                  What are you in the mood for?
                </h1>
                <p className="mt-3 text-muted-foreground">
                  Describe an idea in your own words. We'll turn it into a real,
                  personal sidequest — tied to a place near you when it makes
                  sense.
                </p>

                <textarea
                  autoFocus
                  rows={5}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") generate();
                  }}
                  placeholder="e.g. I want to shake off a stressful week with something calm and a little creative…"
                  className="mt-6 w-full resize-none rounded-3xl border border-border bg-surface px-5 py-4 text-callout leading-relaxed text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary"
                />

                {/* Suggestion chips */}
                <div className="mt-4 flex flex-wrap gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => setPrompt(s)}
                      className="rounded-full border border-border bg-surface px-3.5 py-1.5 text-footnote font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                    >
                      {s}
                    </button>
                  ))}
                </div>

                {status === "error" && error && (
                  <div className="mt-5 flex items-start gap-2.5 rounded-2xl bg-extreme/10 px-4 py-3 text-subheadline text-extreme">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <Button
                  size="lg"
                  className="mt-6 w-full"
                  onClick={generate}
                  disabled={!prompt.trim() || !profile}
                >
                  <Sparkles className="h-5 w-5" />
                  Craft my sidequest
                </Button>
                {!profile && (
                  <p className="mt-3 text-center text-footnote text-muted-foreground">
                    Complete onboarding first so we can tailor it to you.
                  </p>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ResultView({
  item,
  onStart,
  onRetry,
}: {
  item: SidequestItem;
  onStart: () => void;
  onRetry: () => void;
}) {
  const loc = item.locationInformation;
  const miles = formatMiles(loc?.distanceMiles);
  return (
    <div>
      <div className="mb-6 flex items-center gap-2 text-footnote font-medium uppercase tracking-wide text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        Made for you
      </div>

      <div className="overflow-hidden rounded-4xl border border-border bg-surface shadow-card">
        <div className="relative aspect-[3/2] w-full">
          <HeroVisual
            photoURL={loc?.photoURL}
            placeholderIndex={placeholderIndexFor(item.title)}
            alt={item.title}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-6">
            <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-footnote font-medium text-white/90">
              <DifficultyBadge
                difficulty={item.difficulty}
                className="border-white/25 bg-white/15 text-white"
              />
              <span>{formatMinutes(item.estimatedActivityMinutes)}</span>
              {miles && <span>· {miles}</span>}
            </div>
            <h1 className="font-display text-largetitle font-semibold leading-[1.05] text-white drop-shadow-sm">
              {item.title}
            </h1>
          </div>
        </div>
        <div className="space-y-4 p-6">
          <p className="text-callout leading-relaxed text-foreground/90">
            {item.questDescription}
          </p>
          {item.categories.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {item.categories.slice(0, 4).map((c) => (
                <CategoryChip key={c} label={c} />
              ))}
            </div>
          )}
          {loc?.address && (
            <p className="text-footnote font-medium text-muted-foreground">
              {loc.address}
            </p>
          )}
        </div>
      </div>

      <Button size="lg" className="mt-7 w-full" onClick={onStart}>
        <CheckCircle2 className="h-5 w-5" />
        Start this quest
      </Button>
      <button
        onClick={onRetry}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-3.5 text-subheadline font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
      >
        <RotateCcw className="h-4 w-4" />
        Describe something else
      </button>
    </div>
  );
}
