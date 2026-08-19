import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit as fsLimit,
  orderBy,
  query,
  startAfter,
  where,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { getDb } from "./firebase";
import type { GenerationSample, TraceOutcome, TraceType } from "../types";

const COLLECTION = "generation_samples";

export interface SampleFilters {
  type?: TraceType;
  outcome?: TraceOutcome;
  /** Only samples at or after this epoch-ms. */
  since?: number;
}

export interface SamplePage {
  samples: GenerationSample[];
  /** Pass back as `after` to fetch the next page; undefined when exhausted. */
  cursor?: QueryDocumentSnapshot;
}

function toSample(snap: QueryDocumentSnapshot): GenerationSample {
  return { id: snap.id, ...(snap.data() as Omit<GenerationSample, "id">) };
}

/**
 * Build the constraint list shared by both readers.
 *
 * `type` and `outcome` are equality filters combined with a `startedAt` range
 * and ordering, which is why `firestore/firestore.indexes.json` carries a
 * composite index for each. Applying both at once would need a third index, so
 * the UI offers them as alternatives rather than combining them.
 */
function constraintsFor(filters: SampleFilters): QueryConstraint[] {
  const constraints: QueryConstraint[] = [];
  if (filters.type) constraints.push(where("type", "==", filters.type));
  else if (filters.outcome) constraints.push(where("outcome", "==", filters.outcome));
  if (filters.since != null) constraints.push(where("startedAt", ">=", filters.since));
  constraints.push(orderBy("startedAt", "desc"));
  return constraints;
}

/**
 * One page of samples, newest first. Uses a document cursor rather than an
 * offset so paging cost stays flat as the collection grows.
 */
export async function fetchSamplePage(
  filters: SampleFilters,
  pageSize: number,
  after?: QueryDocumentSnapshot
): Promise<SamplePage> {
  const constraints = constraintsFor(filters);
  if (after) constraints.push(startAfter(after));
  constraints.push(fsLimit(pageSize));

  const snap = await getDocs(query(collection(getDb(), COLLECTION), ...constraints));
  return {
    samples: snap.docs.map(toSample),
    cursor: snap.docs.length === pageSize ? snap.docs[snap.docs.length - 1] : undefined,
  };
}

/**
 * The samples the dashboard aggregates over.
 *
 * Capped deliberately: the web SDK cannot project a subset of fields
 * (`select()` is Admin-SDK only), so every document arrives whole — spans,
 * quests and all. The cap bounds what a dashboard load costs; the UI reports
 * when it is reached so a number is never silently computed from a truncated
 * window.
 */
export async function fetchSamplesInWindow(
  since: number,
  cap = 300
): Promise<{ samples: GenerationSample[]; truncated: boolean }> {
  const { samples } = await fetchSamplePage({ since }, cap);
  return { samples, truncated: samples.length === cap };
}

export async function fetchSample(id: string): Promise<GenerationSample | null> {
  const snap = await getDoc(doc(getDb(), COLLECTION, id));
  return snap.exists()
    ? { id: snap.id, ...(snap.data() as Omit<GenerationSample, "id">) }
    : null;
}
