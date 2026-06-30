import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SidequestTimings } from "../types";

/**
 * Developer-facing log of sidequest generation runs. Persisted to its own
 * localStorage key (separate from the main app store) so timing data survives
 * reloads and can be compared across backend changes. Prototype-only — there is
 * no gating; the website exists for quick experimentation.
 */

export interface GenLogEntry {
  id: string;
  /** Epoch ms when the request fired. */
  startedAt: number;
  /** Wall-clock duration of the generateSidequests call, in ms. */
  durationMs: number;
  requestedCount: number;
  returnedCount: number;
  status: "success" | "error";
  /** "live" hits the deployed function; "mock" uses local fixtures. */
  mode: "live" | "mock";
  city: string;
  errorMessage?: string;
  /** Free-form tag the user adds to mark what changed (e.g. "sharded writer"). */
  note?: string;
  /** Per-stage server breakdown. Present for live successful runs only. */
  timings?: SidequestTimings;
}

function uuid() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

interface GenLogState {
  entries: GenLogEntry[];
  addEntry: (e: Omit<GenLogEntry, "id">) => void;
  setNote: (id: string, note: string) => void;
  removeEntry: (id: string) => void;
  clear: () => void;
}

export const useGenLog = create<GenLogState>()(
  persist(
    (set) => ({
      entries: [],
      addEntry: (e) =>
        set((s) => ({
          // Newest first; cap so localStorage can't grow unbounded.
          entries: [{ ...e, id: uuid() }, ...s.entries].slice(0, 200),
        })),
      setNote: (id, note) =>
        set((s) => ({
          entries: s.entries.map((x) => (x.id === id ? { ...x, note } : x)),
        })),
      removeEntry: (id) =>
        set((s) => ({ entries: s.entries.filter((x) => x.id !== id) })),
      clear: () => set({ entries: [] }),
    }),
    { name: "horizon.genlog" }
  )
);
