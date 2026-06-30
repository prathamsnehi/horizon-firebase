import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import { LocationConcept, UserProfile, ScoutConceptsDocument } from "../types";

let db: Firestore | null = null;

/**
 * Lazily initialize the Admin SDK + Firestore. Admin init runs at most once
 * per container; in Cloud Functions `initializeApp()` with no args uses the
 * default service-account credentials and bypasses security rules.
 */
function getDb(): Firestore {
  if (!getApps().length) {
    initializeApp();
  }
  if (!db) {
    db = getFirestore();
  }
  return db;
}

/**
 * Persist the raw Scout (Pass 1) output for inspection. Best-effort: failures
 * are logged and swallowed so they can never break or delay generation.
 */
export async function saveScoutConcepts(
  deviceId: string,
  profile: UserProfile,
  concepts: LocationConcept[]
): Promise<void> {
  try {
    const doc: ScoutConceptsDocument = {
      deviceId,
      city: profile.city,
      count: concepts.length,
      concepts,
      createdAt: Date.now(),
    };
    await getDb().collection("scout_concepts").add(doc);
  } catch (err) {
    console.error("[saveScoutConcepts] Failed to persist scout concepts:", err);
  }
}
