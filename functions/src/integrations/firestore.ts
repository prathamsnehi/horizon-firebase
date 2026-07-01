import { getApps, initializeApp, App } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import { LocationConcept, UserProfile, ScoutConceptsDocument } from "../types";

/**
 * Initialize the Admin SDK once at module load (runs at cold start, before any
 * request). We capture the App instance and pass it explicitly to
 * getFirestore(app) rather than relying on default-app resolution, which was
 * throwing "default Firebase app does not exist" under firebase-admin 13.
 * `initializeApp()` with no args uses the default service-account credentials
 * and bypasses security rules.
 */
const app: App = getApps().length ? getApps()[0]! : initializeApp();
let db: Firestore | null = null;

function getDb(): Firestore {
  if (!db) {
    db = getFirestore(app);
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
  concepts: LocationConcept[],
): Promise<void> {
  try {
    const doc: ScoutConceptsDocument = {
      deviceId,
      profile: profile,
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
