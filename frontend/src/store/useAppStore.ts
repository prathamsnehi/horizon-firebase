import { create } from "zustand";
import { persist } from "zustand/middleware";
import { generateSidequests, ApiError, isMockMode } from "../lib/api";
import { useGenLog } from "../lib/genLog";
import { placeholderIndexFor } from "../data/placeholders";
import type {
  ProfileDraft,
  Quest,
  SidequestItem,
  UserProfile,
} from "../types";

function uuid() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function toQuest(item: SidequestItem, batchId: string): Quest {
  return {
    ...item,
    id: uuid(),
    createdAt: Date.now(),
    batchId,
    status: "available",
    placeholderIndex: placeholderIndexFor(item.title),
    photoIds: [],
  };
}

interface AppState {
  // Persisted
  profile: UserProfile | null;
  hasCompletedOnboarding: boolean;
  draft: ProfileDraft;
  quests: Quest[];
  completedCount: number;
  currentBatchId: string | null;

  // Transient
  generating: boolean;
  error: string | null;

  // Onboarding
  setDraft: (patch: ProfileDraft) => void;
  resetDraft: () => void;
  completeOnboarding: (profile: UserProfile) => void;
  retakeOnboarding: () => void;
  updateProfile: (profile: UserProfile) => void;

  // Generation
  generateBatch: () => Promise<void>;
  clearError: () => void;

  // Deck actions
  skipQuest: (id: string) => void;
  acceptQuest: (id: string) => void;
  swapActive: () => void;

  // Quest detail
  setGetStartedSteps: (id: string, steps: string[]) => void;
  completeQuest: (
    id: string,
    data: { journalEntry?: string; photoIds: string[] }
  ) => void;
  updateCompleted: (
    id: string,
    patch: { journalEntry?: string; photoIds?: string[] }
  ) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      profile: null,
      hasCompletedOnboarding: false,
      draft: {},
      quests: [],
      completedCount: 0,
      currentBatchId: null,
      generating: false,
      error: null,

      setDraft: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),
      resetDraft: () => set({ draft: {} }),

      completeOnboarding: (profile) =>
        set({ profile, hasCompletedOnboarding: true, draft: {} }),

      retakeOnboarding: () =>
        set({ hasCompletedOnboarding: false, draft: get().profile ?? {} }),

      updateProfile: (profile) => set({ profile }),

      clearError: () => set({ error: null }),

      generateBatch: async () => {
        const { profile, quests } = get();
        if (!profile) throw new Error("No profile to generate from.");
        set({ generating: true, error: null });
        const requestedCount = 5;
        const startedAt = Date.now();
        const t0 = performance.now();
        const mode = isMockMode() ? "mock" : "live";
        try {
          const completedTitles = quests
            .filter((q) => q.status === "completed")
            .map((q) => q.title);
          const { items, timings } = await generateSidequests(
            profile,
            requestedCount,
            completedTitles
          );
          const batchId = uuid();
          // Regenerating clears remaining available/skipped; keep active + history.
          const kept = quests.filter(
            (q) => q.status === "active" || q.status === "completed"
          );
          const fresh = items.map((it) => toQuest(it, batchId));
          set({
            quests: [...kept, ...fresh],
            currentBatchId: batchId,
            generating: false,
          });
          useGenLog.getState().addEntry({
            startedAt,
            durationMs: Math.round(performance.now() - t0),
            requestedCount,
            returnedCount: items.length,
            status: "success",
            mode,
            city: profile.city,
            timings,
          });
        } catch (e) {
          const message =
            e instanceof ApiError
              ? e.message
              : "Something went wrong while curating your sidequests.";
          set({ generating: false, error: message });
          useGenLog.getState().addEntry({
            startedAt,
            durationMs: Math.round(performance.now() - t0),
            requestedCount,
            returnedCount: 0,
            status: "error",
            mode,
            city: profile.city,
            errorMessage: message,
          });
          throw e;
        }
      },

      skipQuest: (id) =>
        set((s) => ({
          quests: s.quests.map((q) =>
            q.id === id && q.status === "available"
              ? { ...q, status: "skipped" }
              : q
          ),
        })),

      acceptQuest: (id) =>
        set((s) => ({
          quests: s.quests.map((q) => {
            if (q.id === id) return { ...q, status: "active" };
            if (q.status === "active") return { ...q, status: "available" };
            return q;
          }),
        })),

      swapActive: () =>
        set((s) => ({
          quests: s.quests.map((q) =>
            q.status === "active" ? { ...q, status: "available" } : q
          ),
        })),

      setGetStartedSteps: (id, steps) =>
        set((s) => ({
          quests: s.quests.map((q) =>
            q.id === id ? { ...q, getStartedSteps: steps } : q
          ),
        })),

      completeQuest: (id, data) =>
        set((s) => ({
          completedCount: s.completedCount + 1,
          quests: s.quests.map((q) =>
            q.id === id
              ? {
                  ...q,
                  status: "completed",
                  completedAt: Date.now(),
                  journalEntry: data.journalEntry,
                  photoIds: data.photoIds,
                }
              : q
          ),
        })),

      updateCompleted: (id, patch) =>
        set((s) => ({
          quests: s.quests.map((q) =>
            q.id === id ? { ...q, ...patch } : q
          ),
        })),
    }),
    {
      name: "horizon.app",
      partialize: (s) => ({
        profile: s.profile,
        hasCompletedOnboarding: s.hasCompletedOnboarding,
        draft: s.draft,
        quests: s.quests,
        completedCount: s.completedCount,
        currentBatchId: s.currentBatchId,
      }),
    }
  )
);

// ---- Selectors (call inside components) ----

export const selectActiveQuest = (s: AppState) =>
  s.quests.find((q) => q.status === "active");

export const selectDeck = (s: AppState) =>
  s.quests.filter((q) => q.status === "available" || q.status === "skipped");

export const selectAvailable = (s: AppState) =>
  s.quests.filter((q) => q.status === "available");

export const selectSkipped = (s: AppState) =>
  s.quests.filter((q) => q.status === "skipped");

export const selectCompleted = (s: AppState) =>
  s.quests
    .filter((q) => q.status === "completed")
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
