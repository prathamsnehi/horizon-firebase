import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Sparkles, X } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Pill } from "../../components/ui/Pill";
import { Logo } from "../../components/Logo";
import { CuratingState } from "../../components/CuratingState";
import { useAppStore } from "../../store/useAppStore";
import { geocodeCity } from "../../lib/geocode";
import {
  BUDGET_OPTIONS,
  GROWTH_OPTIONS,
  INTEREST_OPTIONS,
  LOCATION_PREF_OPTIONS,
  TRANSPORT_OPTIONS,
  VIBE_OPTIONS,
  type PillOption,
} from "../../data/onboardingOptions";
import type { TransportationMode, UserProfile } from "../../types";

type MultiField =
  | "interests"
  | "growthAreas"
  | "vibe"
  | "budget"
  | "transportation"
  | "locationPreferences";

interface PillStep {
  kind: "pills";
  field: MultiField;
  title: string;
  subtitle: string;
  options: PillOption[];
  min: number;
}

type Step =
  | { kind: "intro" }
  | PillStep
  | { kind: "spontaneity" }
  | { kind: "city" }
  | { kind: "context" };

const STEPS: Step[] = [
  { kind: "intro" },
  {
    kind: "pills",
    field: "interests",
    title: "What are you curious about?",
    subtitle: "Pick everything that pulls at you. These shape your quests.",
    options: INTEREST_OPTIONS,
    min: 1,
  },
  {
    kind: "pills",
    field: "growthAreas",
    title: "Where do you want to grow?",
    subtitle: "We'll nudge you toward these, gently or boldly.",
    options: GROWTH_OPTIONS,
    min: 1,
  },
  {
    kind: "pills",
    field: "vibe",
    title: "How do you want it to feel?",
    subtitle: "Your quests will lean into the vibes you choose.",
    options: VIBE_OPTIONS,
    min: 1,
  },
  { kind: "spontaneity" },
  {
    kind: "pills",
    field: "budget",
    title: "What's your spend?",
    subtitle: "We'll respect your wallet.",
    options: BUDGET_OPTIONS,
    min: 1,
  },
  {
    kind: "pills",
    field: "transportation",
    title: "How do you get around?",
    subtitle: "Quests stay within reach of how you travel.",
    options: TRANSPORT_OPTIONS as PillOption[],
    min: 1,
  },
  {
    kind: "pills",
    field: "locationPreferences",
    title: "Where do you like to be?",
    subtitle: "The kinds of places that feel like you.",
    options: LOCATION_PREF_OPTIONS,
    min: 1,
  },
  { kind: "city" },
  { kind: "context" },
];

const SPONTANEITY_LABELS = [
  "Keep it predictable",
  "Mostly familiar",
  "A balanced mix",
  "Push me a little",
  "Throw me wildcards",
];

export default function Onboarding() {
  const navigate = useNavigate();
  const draft = useAppStore((s) => s.draft);
  const setDraft = useAppStore((s) => s.setDraft);
  const completeOnboarding = useAppStore((s) => s.completeOnboarding);
  const generateBatch = useAppStore((s) => s.generateBatch);

  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);
  const [geocoding, setGeocoding] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const step = STEPS[index];
  const progress = index / (STEPS.length - 1);

  const selected = (field: MultiField): string[] =>
    (draft[field] as string[] | undefined) ?? [];

  const toggle = (field: MultiField, value: string) => {
    const cur = selected(field);
    const next = cur.includes(value)
      ? cur.filter((v) => v !== value)
      : [...cur, value];
    setDraft({ [field]: next } as Partial<UserProfile>);
  };

  const canProceed = useMemo(() => {
    if (step.kind === "pills") return selected(step.field).length >= step.min;
    if (step.kind === "city") return !!draft.city?.trim();
    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, draft]);

  const go = (delta: number) => {
    setDir(delta);
    setIndex((i) => Math.min(STEPS.length - 1, Math.max(0, i + delta)));
    setError(null);
  };

  const onCityBlur = async () => {
    const city = draft.city?.trim();
    if (!city) return;
    setGeocoding(true);
    const hit = await geocodeCity(city);
    setGeocoding(false);
    if (hit) {
      setDraft({
        city: hit.admin1 ? `${hit.name}` : hit.name,
        cityLatitude: hit.latitude,
        cityLongitude: hit.longitude,
      });
    }
  };

  const submit = async () => {
    const profile: UserProfile = {
      interests: selected("interests"),
      growthAreas: selected("growthAreas"),
      vibe: selected("vibe"),
      experimentationLevel: draft.experimentationLevel ?? 3,
      budget: selected("budget"),
      transportation: (draft.transportation as TransportationMode[]) ?? [],
      locationPreferences: selected("locationPreferences"),
      additionalContext: draft.additionalContext?.trim()
        ? draft.additionalContext.trim()
        : null,
      city: draft.city?.trim() || "",
      cityLatitude: draft.cityLatitude,
      cityLongitude: draft.cityLongitude,
    };
    completeOnboarding(profile);
    setSubmitting(true);
    setError(null);
    try {
      await generateBatch();
      navigate("/app/discover", { replace: true });
    } catch {
      setSubmitting(false);
      setError(
        "We couldn't curate your quests just now. Please try again in a moment."
      );
    }
  };

  if (submitting) {
    return (
      <div className="min-h-full bg-background">
        <CuratingState message="Curating your first quests…" />
      </div>
    );
  }

  const isLast = index === STEPS.length - 1;

  return (
    <div className="flex min-h-full flex-col bg-background">
      {/* Top bar: progress + exit */}
      <header className="sticky top-0 z-10 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-4 px-6 py-4">
          <Logo withText={false} />
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-muted">
            <motion.div
              className="h-full rounded-full bg-primary"
              initial={false}
              animate={{ width: `${Math.max(progress * 100, 4)}%` }}
              transition={{ type: "spring", stiffness: 200, damping: 30 }}
            />
          </div>
          <button
            onClick={() => navigate("/")}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Exit onboarding"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6">
        <div className="flex flex-1 items-start pt-6 sm:items-center sm:pt-0">
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div
              key={index}
              custom={dir}
              initial={{ opacity: 0, x: dir * 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: dir * -40 }}
              transition={{ duration: 0.25 }}
              className="w-full"
            >
              <StepBody
                step={step}
                draft={draft}
                selected={selected}
                toggle={toggle}
                setDraft={setDraft}
                onCityBlur={onCityBlur}
                geocoding={geocoding}
              />
            </motion.div>
          </AnimatePresence>
        </div>

        {error && (
          <p className="mb-3 rounded-xl bg-extreme/10 px-4 py-3 text-subheadline text-extreme">
            {error}
          </p>
        )}

        {/* Footer nav */}
        <div className="sticky bottom-0 flex items-center justify-between gap-3 bg-background/90 py-5 backdrop-blur">
          {index > 0 ? (
            <Button variant="ghost" onClick={() => go(-1)}>
              <ArrowLeft className="h-5 w-5" />
              Back
            </Button>
          ) : (
            <span />
          )}

          {isLast ? (
            <Button size="lg" onClick={submit}>
              <Sparkles className="h-5 w-5" />
              Generate my quests
            </Button>
          ) : (
            <Button size="lg" onClick={() => go(1)} disabled={!canProceed}>
              {index === 0 ? "Let's go" : "Next"}
              <ArrowRight className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function StepBody({
  step,
  draft,
  selected,
  toggle,
  setDraft,
  onCityBlur,
  geocoding,
}: {
  step: Step;
  draft: ReturnType<typeof useAppStore.getState>["draft"];
  selected: (f: MultiField) => string[];
  toggle: (f: MultiField, v: string) => void;
  setDraft: (p: Partial<UserProfile>) => void;
  onCityBlur: () => void;
  geocoding: boolean;
}) {
  if (step.kind === "intro") {
    return (
      <div className="text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/15 text-primary">
          <Sparkles className="h-8 w-8" />
        </div>
        <h1 className="text-largetitle font-bold tracking-tight text-foreground">
          Let's build your Horizon
        </h1>
        <p className="mx-auto mt-4 max-w-md text-lg text-muted-foreground">
          A handful of quick taps — no essays. The more honest you are, the
          better your quests. This stays on your device.
        </p>
      </div>
    );
  }

  if (step.kind === "pills") {
    const sel = selected(step.field);
    return (
      <div>
        <StepHeading title={step.title} subtitle={step.subtitle} />
        <div className="flex flex-wrap gap-2.5">
          {step.options.map((opt) => (
            <Pill
              key={opt.value}
              emoji={opt.emoji}
              selected={sel.includes(opt.value)}
              onClick={() => toggle(step.field, opt.value)}
            >
              {opt.label}
            </Pill>
          ))}
        </div>
      </div>
    );
  }

  if (step.kind === "spontaneity") {
    const value = draft.experimentationLevel ?? 3;
    return (
      <div>
        <StepHeading
          title="How spontaneous should we get?"
          subtitle="Higher means more wildcards beyond your stated tastes."
        />
        <div className="rounded-3xl border border-border bg-surface p-7">
          <div className="mb-6 text-center">
            <span className="text-largetitle font-bold text-primary">
              {value}
            </span>
            <p className="mt-1 text-headline font-medium text-foreground">
              {SPONTANEITY_LABELS[value - 1]}
            </p>
          </div>
          <input
            type="range"
            min={1}
            max={5}
            step={1}
            value={value}
            onChange={(e) =>
              setDraft({ experimentationLevel: Number(e.target.value) })
            }
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-surface-muted accent-primary"
          />
          <div className="mt-3 flex justify-between text-caption text-muted-foreground">
            <span>Predictable</span>
            <span>Wildcard</span>
          </div>
        </div>
      </div>
    );
  }

  if (step.kind === "city") {
    return (
      <div>
        <StepHeading
          title="Where are you based?"
          subtitle="We use your city to find real places nearby."
        />
        <input
          type="text"
          autoFocus
          value={draft.city ?? ""}
          onChange={(e) => setDraft({ city: e.target.value })}
          onBlur={onCityBlur}
          placeholder="e.g. San Francisco"
          className="w-full rounded-2xl border border-border bg-surface px-5 py-4 text-title3 text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary"
        />
        <p className="mt-3 h-5 text-footnote text-muted-foreground">
          {geocoding
            ? "Finding your city…"
            : draft.cityLatitude != null
            ? "✓ Location set — quests will include distance & travel times."
            : "We'll confirm the location when you continue."}
        </p>
      </div>
    );
  }

  // context
  return (
    <div>
      <StepHeading
        title="Anything else we should know?"
        subtitle="Optional. A detail or two helps us tailor the experience."
      />
      <textarea
        rows={4}
        value={draft.additionalContext ?? ""}
        onChange={(e) => setDraft({ additionalContext: e.target.value })}
        placeholder="e.g. I have a dog, I'm new in town, I love spicy food…"
        className="w-full resize-none rounded-2xl border border-border bg-surface px-5 py-4 text-callout text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary"
      />
      <p className="mt-3 text-footnote text-muted-foreground">
        You're all set — tap “Generate my quests” to get your first deck of ten.
      </p>
    </div>
  );
}

function StepHeading({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mb-7">
      <h1 className="text-title1 font-bold tracking-tight text-foreground">
        {title}
      </h1>
      <p className="mt-2 text-muted-foreground">{subtitle}</p>
    </div>
  );
}
