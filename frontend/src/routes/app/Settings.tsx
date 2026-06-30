import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Sparkles, Save } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Pill } from "../../components/ui/Pill";
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
import type { UserProfile } from "../../types";

type MultiField =
  | "interests"
  | "growthAreas"
  | "vibe"
  | "budget"
  | "transportation"
  | "locationPreferences";

const PILL_SECTIONS: {
  field: MultiField;
  title: string;
  options: PillOption[];
}[] = [
  { field: "interests", title: "Interests", options: INTEREST_OPTIONS },
  { field: "growthAreas", title: "Growth areas", options: GROWTH_OPTIONS },
  { field: "vibe", title: "Vibe", options: VIBE_OPTIONS },
  { field: "budget", title: "Budget", options: BUDGET_OPTIONS },
  {
    field: "transportation",
    title: "Transportation",
    options: TRANSPORT_OPTIONS as PillOption[],
  },
  {
    field: "locationPreferences",
    title: "Location preferences",
    options: LOCATION_PREF_OPTIONS,
  },
];

const SPONTANEITY_LABELS = [
  "Keep it predictable",
  "Mostly familiar",
  "A balanced mix",
  "Push me a little",
  "Throw me wildcards",
];

function normalize(p: UserProfile): UserProfile {
  return {
    ...p,
    additionalContext: p.additionalContext?.trim()
      ? p.additionalContext.trim()
      : null,
    city: p.city?.trim() || "",
  };
}

export default function Settings() {
  const navigate = useNavigate();
  const profile = useAppStore((s) => s.profile);
  const updateProfile = useAppStore((s) => s.updateProfile);
  const generateBatch = useAppStore((s) => s.generateBatch);

  const [form, setForm] = useState<UserProfile | null>(profile);
  const [geocoding, setGeocoding] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!form) {
    return (
      <Shell>
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
          <p className="text-title3 font-semibold text-foreground">
            No profile yet
          </p>
          <p className="max-w-sm text-muted-foreground">
            Complete onboarding first, then come back here to tweak your
            preferences.
          </p>
          <Button onClick={() => navigate("/app/onboarding")}>
            Start onboarding
          </Button>
        </div>
      </Shell>
    );
  }

  const patch = (p: Partial<UserProfile>) => {
    setForm((f) => (f ? { ...f, ...p } : f));
    setSaved(false);
  };

  const toggle = (field: MultiField, value: string) => {
    const cur = (form[field] as string[] | undefined) ?? [];
    const next = cur.includes(value)
      ? cur.filter((v) => v !== value)
      : [...cur, value];
    patch({ [field]: next } as Partial<UserProfile>);
  };

  const onCityBlur = async () => {
    const city = form.city?.trim();
    if (!city) return;
    setGeocoding(true);
    const hit = await geocodeCity(city);
    setGeocoding(false);
    if (hit) {
      patch({
        city: hit.name,
        cityLatitude: hit.latitude,
        cityLongitude: hit.longitude,
      });
    }
  };

  const dirty = JSON.stringify(form) !== JSON.stringify(profile);
  const spontaneity = form.experimentationLevel ?? 3;

  const save = () => {
    updateProfile(normalize(form));
    setSaved(true);
  };

  const saveAndGenerate = () => {
    updateProfile(normalize(form));
    // Fire-and-forget; Discover renders the curating state via `generating`.
    generateBatch().catch(() => {});
    navigate("/app/discover");
  };

  return (
    <Shell>
      <div className="mb-7">
        <h1 className="text-title1 font-bold tracking-tight text-foreground">
          Preferences
        </h1>
        <p className="mt-1 text-muted-foreground">
          Tune your profile without retaking onboarding. Changes apply to your
          next batch of quests.
        </p>
      </div>

      <div className="space-y-7 pb-32">
        {PILL_SECTIONS.map((section) => {
          const sel = (form[section.field] as string[] | undefined) ?? [];
          return (
            <Section key={section.field} title={section.title}>
              <div className="flex flex-wrap gap-2.5">
                {section.options.map((opt) => (
                  <Pill
                    key={opt.value}
                    emoji={opt.emoji}
                    selected={sel.includes(opt.value)}
                    onClick={() => toggle(section.field, opt.value)}
                  >
                    {opt.label}
                  </Pill>
                ))}
              </div>
            </Section>
          );
        })}

        <Section title="Spontaneity">
          <div className="mb-5 flex items-baseline gap-3">
            <span className="text-title2 font-bold text-primary">
              {spontaneity}
            </span>
            <span className="text-headline font-medium text-foreground">
              {SPONTANEITY_LABELS[spontaneity - 1]}
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={5}
            step={1}
            value={spontaneity}
            onChange={(e) =>
              patch({ experimentationLevel: Number(e.target.value) })
            }
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-surface-muted accent-primary"
          />
          <div className="mt-3 flex justify-between text-caption text-muted-foreground">
            <span>Predictable</span>
            <span>Wildcard</span>
          </div>
        </Section>

        <Section title="City">
          <input
            type="text"
            value={form.city ?? ""}
            onChange={(e) => patch({ city: e.target.value })}
            onBlur={onCityBlur}
            placeholder="e.g. San Francisco"
            className="w-full rounded-2xl border border-border bg-surface px-5 py-4 text-title3 text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary"
          />
          <p className="mt-3 h-5 text-footnote text-muted-foreground">
            {geocoding
              ? "Finding your city…"
              : form.cityLatitude != null
              ? `✓ ${form.cityLatitude.toFixed(3)}, ${form.cityLongitude?.toFixed(
                  3
                )} — quests include distance & travel times.`
              : "We'll confirm the location when you click away."}
          </p>
        </Section>

        <Section title="Additional context">
          <textarea
            rows={4}
            value={form.additionalContext ?? ""}
            onChange={(e) => patch({ additionalContext: e.target.value })}
            placeholder="e.g. I have a dog, I'm new in town, I love spicy food…"
            className="w-full resize-none rounded-2xl border border-border bg-surface px-5 py-4 text-callout text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary"
          />
        </Section>
      </div>

      {/* Sticky save bar */}
      <div className="fixed inset-x-0 bottom-16 z-40 border-t border-border bg-surface/95 backdrop-blur md:bottom-0 md:left-64">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-6 py-4">
          <span className="text-footnote text-muted-foreground">
            {saved && !dirty
              ? "Saved ✓"
              : dirty
              ? "Unsaved changes"
              : "No changes"}
          </span>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={save} disabled={!dirty}>
              {saved && !dirty ? (
                <Check className="h-5 w-5" />
              ) : (
                <Save className="h-5 w-5" />
              )}
              Save
            </Button>
            <Button onClick={saveAndGenerate}>
              <Sparkles className="h-5 w-5" />
              Save &amp; generate
            </Button>
          </div>
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-8 sm:py-12">{children}</div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-border bg-surface/40 p-6">
      <h2 className="mb-4 text-headline font-semibold text-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}
