import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  CheckCircle2,
  ImagePlus,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "../../components/ui/Button";
import { cn } from "../../lib/cn";
import { deletePhoto, savePhoto } from "../../lib/photos";
import { useAppStore } from "../../store/useAppStore";

interface DraftPhoto {
  id: string;
  url: string;
}

const STEP_LABELS = ["Photos", "Journal", "Confirm"];

export default function Completion() {
  const { questId } = useParams();
  const navigate = useNavigate();
  const quest = useAppStore((s) => s.quests.find((q) => q.id === questId));
  const completeQuest = useAppStore((s) => s.completeQuest);

  const [step, setStep] = useState(0);
  const [photos, setPhotos] = useState<DraftPhoto[]>([]);
  const [journal, setJournal] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Revoke preview URLs on unmount.
  useEffect(() => {
    return () => photos.forEach((p) => URL.revokeObjectURL(p.url));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!quest || quest.status === "completed") {
    return <Navigate to="/app/home" replace />;
  }

  const addFiles = async (files: FileList | null) => {
    if (!files) return;
    const added: DraftPhoto[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      const id = await savePhoto(file);
      added.push({ id, url: URL.createObjectURL(file) });
    }
    setPhotos((p) => [...p, ...added]);
  };

  const removePhoto = async (id: string) => {
    setPhotos((p) => {
      const target = p.find((x) => x.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return p.filter((x) => x.id !== id);
    });
    await deletePhoto(id);
  };

  const finish = () => {
    completeQuest(quest.id, {
      journalEntry: journal.trim() || undefined,
      photoIds: photos.map((p) => p.id),
    });
    navigate(`/app/history/${quest.id}`, { replace: true });
  };

  const canNext = step !== 0 || photos.length > 0;

  return (
    <div className="min-h-full bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-4 px-6 py-4">
          <button
            onClick={() => navigate("/app/home")}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Cancel"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="flex flex-1 items-center justify-center gap-2">
            {STEP_LABELS.map((label, i) => (
              <div key={label} className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-caption font-bold transition-colors",
                    i <= step
                      ? "bg-primary text-primary-foreground"
                      : "bg-surface-muted text-muted-foreground"
                  )}
                >
                  {i + 1}
                </span>
                <span
                  className={cn(
                    "hidden text-footnote font-medium sm:inline",
                    i <= step ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {label}
                </span>
                {i < STEP_LABELS.length - 1 && (
                  <span className="h-px w-5 bg-border" />
                )}
              </div>
            ))}
          </div>
          <span className="w-5" />
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-6 py-8">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          {step === 0 && (
            <section>
              <h1 className="font-display text-title1 font-semibold tracking-tight text-foreground">
                Capture the moment
              </h1>
              <p className="mt-2 text-muted-foreground">
                Add at least one photo from “{quest.title}”.
              </p>

              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => addFiles(e.target.files)}
              />

              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {photos.map((p) => (
                  <div
                    key={p.id}
                    className="group relative aspect-square overflow-hidden rounded-2xl border border-border"
                  >
                    <img
                      src={p.url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                    <button
                      onClick={() => removePhoto(p.id)}
                      className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition-opacity group-hover:opacity-100"
                      aria-label="Remove photo"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  <ImagePlus className="h-7 w-7" />
                  <span className="text-footnote font-medium">Add photos</span>
                </button>
              </div>
            </section>
          )}

          {step === 1 && (
            <section>
              <h1 className="font-display text-title1 font-semibold tracking-tight text-foreground">
                How was it?
              </h1>
              <p className="mt-2 text-muted-foreground">
                Optional — jot down a reflection while it's fresh. You can edit
                this later.
              </p>
              <textarea
                autoFocus
                rows={8}
                value={journal}
                onChange={(e) => setJournal(e.target.value)}
                placeholder="What surprised you? How did it feel? Would you do it again?"
                className="mt-6 w-full resize-none rounded-2xl border border-border bg-surface px-5 py-4 text-callout leading-relaxed text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary"
              />
            </section>
          )}

          {step === 2 && (
            <section>
              <h1 className="font-display text-title1 font-semibold tracking-tight text-foreground">
                Looking good
              </h1>
              <p className="mt-2 text-muted-foreground">
                Here's your completed quest. Ready to add it to your history?
              </p>

              <div className="mt-6 overflow-hidden rounded-3xl border border-border bg-surface">
                {photos[0] && (
                  <img
                    src={photos[0].url}
                    alt=""
                    className="h-56 w-full object-cover"
                  />
                )}
                <div className="space-y-4 p-6">
                  <div>
                    <p className="text-footnote font-semibold uppercase tracking-wide text-primary">
                      Completed
                    </p>
                    <h2 className="mt-1 text-title3 font-bold text-foreground">
                      {quest.title}
                    </h2>
                  </div>
                  {photos.length > 1 && (
                    <div className="flex gap-2">
                      {photos.slice(1, 5).map((p) => (
                        <img
                          key={p.id}
                          src={p.url}
                          alt=""
                          className="h-16 w-16 rounded-xl object-cover"
                        />
                      ))}
                    </div>
                  )}
                  {journal.trim() && (
                    <p className="border-l-2 border-primary/40 pl-4 text-callout italic leading-relaxed text-muted-foreground">
                      {journal.trim()}
                    </p>
                  )}
                </div>
              </div>
            </section>
          )}
        </motion.div>
      </div>

      {/* Footer nav */}
      <div className="sticky bottom-0 border-t border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-6 py-4">
          {step > 0 ? (
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
              <ArrowLeft className="h-5 w-5" />
              Back
            </Button>
          ) : (
            <span className="inline-flex items-center gap-2 text-footnote text-muted-foreground">
              <Camera className="h-4 w-4" />
              {photos.length} photo{photos.length === 1 ? "" : "s"}
            </span>
          )}

          {step < 2 ? (
            <Button
              size="lg"
              onClick={() => setStep((s) => s + 1)}
              disabled={!canNext}
            >
              {step === 1 && journal.trim() === "" ? "Skip" : "Next"}
              <ArrowRight className="h-5 w-5" />
            </Button>
          ) : (
            <Button size="lg" onClick={finish}>
              <CheckCircle2 className="h-5 w-5" />
              Complete quest
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
