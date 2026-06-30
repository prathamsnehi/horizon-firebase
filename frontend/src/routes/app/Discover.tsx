import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";
import { RefreshCw, X, Check, AlertCircle } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { SwipeCard } from "../../components/SwipeCard";
import { HeroVisual } from "../../components/HeroVisual";
import { QuestMeta } from "../../components/QuestMeta";
import { CuratingState } from "../../components/CuratingState";
import {
  selectAvailable,
  selectSkipped,
  useAppStore,
} from "../../store/useAppStore";

export default function Discover() {
  const navigate = useNavigate();
  const available = useAppStore(useShallow(selectAvailable));
  const skipped = useAppStore(useShallow(selectSkipped));
  const generating = useAppStore((s) => s.generating);
  const error = useAppStore((s) => s.error);
  const completedCount = useAppStore((s) => s.completedCount);
  const profile = useAppStore((s) => s.profile);
  const generateBatch = useAppStore((s) => s.generateBatch);
  const clearError = useAppStore((s) => s.clearError);
  const skipQuest = useAppStore((s) => s.skipQuest);
  const acceptQuest = useAppStore((s) => s.acceptQuest);

  const deckTotal = available.length + skipped.length;
  const triggered = useRef(false);

  // Auto-generate a fresh batch when the deck is fully exhausted.
  useEffect(() => {
    if (deckTotal > 0) {
      triggered.current = false;
      return;
    }
    if (!generating && !error && profile && !triggered.current) {
      triggered.current = true;
      generateBatch().catch(() => {});
    }
  }, [deckTotal, generating, error, profile, generateBatch]);

  const top = available[0];

  const accept = (id: string) => {
    acceptQuest(id);
    navigate("/app/home");
  };

  // Keyboard: ← skip, → accept the top card.
  useEffect(() => {
    if (!top) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") skipQuest(top.id);
      if (e.key === "ArrowRight") accept(top.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [top?.id]);

  if (generating) {
    return (
      <Shell>
        <CuratingState />
      </Shell>
    );
  }

  if (error && deckTotal === 0) {
    return (
      <Shell>
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-extreme/15 text-extreme">
            <AlertCircle className="h-7 w-7" />
          </div>
          <div>
            <p className="text-title3 font-semibold text-foreground">
              Couldn't load your quests
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

  // All cards skipped → list fallback.
  if (available.length === 0 && skipped.length > 0) {
    return (
      <Shell>
        <Header
          title="Pick one to get started"
          subtitle="You've seen them all — choose the one that's calling you."
          showRegen={completedCount >= 1}
          onRegen={() => generateBatch().catch(() => {})}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {skipped.map((q) => (
            <button
              key={q.id}
              onClick={() => accept(q.id)}
              className="group flex gap-4 rounded-2xl border border-border bg-surface p-3 text-left transition-all hover:border-primary/50 hover:shadow-card"
            >
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl">
                <HeroVisual
                  photoURL={q.locationInformation?.photoURL}
                  placeholderIndex={q.placeholderIndex}
                  alt={q.title}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-headline font-semibold text-foreground">
                  {q.title}
                </p>
                <div className="mt-1.5">
                  <QuestMeta quest={q} size="sm" />
                </div>
              </div>
            </button>
          ))}
        </div>
      </Shell>
    );
  }

  // Swipe deck.
  const stack = available.slice(0, 3);
  return (
    <Shell>
      <Header
        title="Discover"
        subtitle={`${available.length} of ${deckTotal} remaining`}
        showRegen={completedCount >= 1}
        onRegen={() => generateBatch().catch(() => {})}
      />

      <div className="relative mx-auto aspect-[3/4] w-full max-w-sm">
        {stack
          .map((q, i) => (
            <SwipeCard
              key={q.id}
              quest={q}
              isTop={i === 0}
              depth={i}
              onSkip={() => skipQuest(q.id)}
              onAccept={() => accept(q.id)}
            />
          ))
          // Render back-to-front so the top card paints last.
          .reverse()}
      </div>

      <div className="mx-auto mt-7 flex max-w-sm items-center justify-center gap-6">
        <button
          onClick={() => top && skipQuest(top.id)}
          aria-label="Skip"
          className="flex h-16 w-16 items-center justify-center rounded-full border border-border bg-surface text-extreme shadow-card transition-all hover:scale-105 active:scale-95"
        >
          <X className="h-7 w-7" strokeWidth={2.5} />
        </button>
        <button
          onClick={() => top && accept(top.id)}
          aria-label="Accept"
          className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-float transition-all hover:scale-105 active:scale-95"
        >
          <Check className="h-9 w-9" strokeWidth={2.5} />
        </button>
      </div>
      <p className="mt-5 text-center text-footnote text-muted-foreground">
        Drag the card, use the buttons, or press ← / →
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-8 sm:py-12">{children}</div>
  );
}

function Header({
  title,
  subtitle,
  showRegen,
  onRegen,
}: {
  title: string;
  subtitle: string;
  showRegen: boolean;
  onRegen: () => void;
}) {
  return (
    <div className="mb-7 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-title1 font-bold tracking-tight text-foreground">
          {title}
        </h1>
        <p className="mt-1 text-muted-foreground">{subtitle}</p>
      </div>
      {showRegen && (
        <Button variant="secondary" size="sm" onClick={onRegen}>
          <RefreshCw className="h-4 w-4" />
          New batch
        </Button>
      )}
    </div>
  );
}
