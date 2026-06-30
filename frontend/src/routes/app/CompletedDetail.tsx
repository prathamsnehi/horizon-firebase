import { useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  ImagePlus,
  Loader2,
  Pencil,
  Share2,
  Trash2,
} from "lucide-react";
import { Button } from "../../components/ui/Button";
import { IdbImage } from "../../components/IdbImage";
import { DifficultyBadge } from "../../components/DifficultyBadge";
import { CategoryChip } from "../../components/CategoryChip";
import { formatDate } from "../../lib/format";
import { deletePhoto, savePhoto } from "../../lib/photos";
import { generateCollage, shareCollage } from "../../lib/collage";
import { useAppStore } from "../../store/useAppStore";

export default function CompletedDetail() {
  const { questId } = useParams();
  const navigate = useNavigate();
  const quest = useAppStore((s) => s.quests.find((q) => q.id === questId));
  const updateCompleted = useAppStore((s) => s.updateCompleted);

  const fileRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [journalDraft, setJournalDraft] = useState(quest?.journalEntry ?? "");
  const [sharing, setSharing] = useState(false);

  if (!quest || quest.status !== "completed") {
    return <Navigate to="/app/history" replace />;
  }

  const addFiles = async (files: FileList | null) => {
    if (!files) return;
    const ids: string[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      ids.push(await savePhoto(file));
    }
    if (ids.length) {
      updateCompleted(quest.id, { photoIds: [...quest.photoIds, ...ids] });
    }
  };

  const removePhoto = async (id: string) => {
    updateCompleted(quest.id, {
      photoIds: quest.photoIds.filter((p) => p !== id),
    });
    await deletePhoto(id);
  };

  const saveJournal = () => {
    updateCompleted(quest.id, { journalEntry: journalDraft.trim() || undefined });
    setEditing(false);
  };

  const share = async () => {
    setSharing(true);
    try {
      const blob = await generateCollage(quest.photoIds, quest.title);
      if (blob) await shareCollage(blob, quest.title);
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-6 py-6 sm:py-10">
      <button
        onClick={() => navigate("/app/history")}
        className="mb-6 inline-flex items-center gap-2 text-subheadline font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        History
      </button>

      {/* Title block */}
      <div className="mb-6">
        <p className="text-footnote font-semibold uppercase tracking-wide text-primary">
          Completed {quest.completedAt ? formatDate(quest.completedAt) : ""}
        </p>
        <h1 className="mt-1 text-title1 font-bold tracking-tight text-foreground">
          {quest.title}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <DifficultyBadge difficulty={quest.difficulty} />
          {quest.categories.map((c) => (
            <CategoryChip key={c} label={c} />
          ))}
        </div>
      </div>

      <p className="mb-7 text-callout leading-relaxed text-muted-foreground">
        {quest.questDescription}
      </p>

      {/* Photo gallery */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => addFiles(e.target.files)}
      />
      <div className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-headline font-semibold text-foreground">Photos</h2>
          <button
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 text-subheadline font-medium text-primary hover:opacity-80"
          >
            <ImagePlus className="h-4 w-4" />
            Add
          </button>
        </div>
        {quest.photoIds.length === 0 ? (
          <button
            onClick={() => fileRef.current?.click()}
            className="flex h-32 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary"
          >
            <ImagePlus className="h-6 w-6" />
            <span className="text-footnote">Add photos</span>
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {quest.photoIds.map((id) => (
              <div
                key={id}
                className="group relative aspect-square overflow-hidden rounded-2xl border border-border"
              >
                <IdbImage id={id} alt={quest.title} />
                <button
                  onClick={() => removePhoto(id)}
                  className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label="Remove photo"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Journal */}
      <div className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-headline font-semibold text-foreground">
            Reflection
          </h2>
          {!editing && (
            <button
              onClick={() => {
                setJournalDraft(quest.journalEntry ?? "");
                setEditing(true);
              }}
              className="inline-flex items-center gap-1.5 text-subheadline font-medium text-primary hover:opacity-80"
            >
              <Pencil className="h-4 w-4" />
              Edit
            </button>
          )}
        </div>
        {editing ? (
          <div>
            <textarea
              autoFocus
              rows={6}
              value={journalDraft}
              onChange={(e) => setJournalDraft(e.target.value)}
              placeholder="How was it?"
              className="w-full resize-none rounded-2xl border border-border bg-surface px-5 py-4 text-callout leading-relaxed text-foreground outline-none focus:border-primary"
            />
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={saveJournal}>
                <Check className="h-4 w-4" />
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : quest.journalEntry ? (
          <p className="whitespace-pre-wrap rounded-2xl border border-border bg-surface px-5 py-4 text-callout leading-relaxed text-foreground">
            {quest.journalEntry}
          </p>
        ) : (
          <p className="rounded-2xl border border-dashed border-border px-5 py-4 text-callout text-muted-foreground">
            No reflection yet. Tap edit to add one.
          </p>
        )}
      </div>

      {/* Share */}
      <Button
        variant="secondary"
        size="lg"
        className="w-full"
        onClick={share}
        disabled={sharing || quest.photoIds.length === 0}
      >
        {sharing ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Share2 className="h-5 w-5" />
        )}
        {sharing ? "Building collage…" : "Share a collage"}
      </Button>
    </div>
  );
}
