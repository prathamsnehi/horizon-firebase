import { Link } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";
import { ChevronRight, History as HistoryIcon, Compass } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { IdbImage } from "../../components/IdbImage";
import { HeroVisual } from "../../components/HeroVisual";
import { DifficultyBadge } from "../../components/DifficultyBadge";
import { formatDate } from "../../lib/format";
import { selectCompleted, useAppStore } from "../../store/useAppStore";

export default function History() {
  const completed = useAppStore(useShallow(selectCompleted));

  if (completed.length === 0) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-6 text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/15 text-primary">
          <HistoryIcon className="h-10 w-10" />
        </div>
        <h1 className="text-title1 font-bold tracking-tight text-foreground">
          Your story starts here
        </h1>
        <p className="mt-3 max-w-sm text-muted-foreground">
          Completed quests live here as a journal of photos and reflections.
          Finish your first one to begin.
        </p>
        <Link to="/app/discover" className="mt-7">
          <Button size="lg">
            <Compass className="h-5 w-5" />
            Find a quest
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-8 sm:py-12">
      <div className="mb-7">
        <h1 className="text-title1 font-bold tracking-tight text-foreground">
          History
        </h1>
        <p className="mt-1 text-muted-foreground">
          {completed.length} quest{completed.length === 1 ? "" : "s"} completed
        </p>
      </div>

      <ul className="space-y-3">
        {completed.map((q) => (
          <li key={q.id}>
            <Link
              to={`/app/history/${q.id}`}
              className="group flex items-center gap-4 rounded-2xl border border-border bg-surface p-3 transition-all hover:border-primary/50 hover:shadow-card"
            >
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl">
                {q.photoIds[0] ? (
                  <IdbImage id={q.photoIds[0]} alt={q.title} />
                ) : (
                  <HeroVisual
                    photoURL={q.locationInformation?.photoURL}
                    placeholderIndex={q.placeholderIndex}
                    alt={q.title}
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-headline font-semibold text-foreground">
                  {q.title}
                </p>
                <div className="mt-1 flex items-center gap-2 text-footnote text-muted-foreground">
                  <DifficultyBadge difficulty={q.difficulty} />
                  {q.completedAt && <span>{formatDate(q.completedAt)}</span>}
                </div>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
