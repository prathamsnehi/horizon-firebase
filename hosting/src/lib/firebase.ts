import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

/**
 * Firebase web config.
 *
 * This is NOT a secret. Every Firebase web app ships these values in its bundle
 * — they identify the project, they do not authorise anything. Access is
 * controlled by Firebase Auth plus the Firestore security rules in
 * `firestore/firestore.rules`, which is why hardcoding here is safe and saves
 * plumbing build-time variables through CI.
 *
 * Fill these in from: Firebase console -> Project settings -> Your apps -> Web.
 */
const firebaseConfig = {
  apiKey: "AIzaSyC_rlal_3vwUhCeB70wyrNFHmSaB5Nnmfw",
  authDomain: "horizon-sidequests.firebaseapp.com",
  projectId: "horizon-sidequests",
  storageBucket: "horizon-sidequests.firebasestorage.app",
  messagingSenderId: "702464500662",
  appId: "1:702464500662:web:74d5269888be3e34cf5717",
  measurementId: "G-FQ49PVLZTF"
};

/** True once the placeholders above have been replaced with the real config. */
export function isFirebaseConfigured(): boolean {
  return !Object.values(firebaseConfig).some((v) => v === "REPLACE_ME");
}

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;

function ensureApp(): FirebaseApp {
  if (!isFirebaseConfigured()) {
    throw new Error(
      "Firebase is not configured — replace the REPLACE_ME values in " +
        "hosting/src/lib/firebase.ts with the web app config from the Firebase console."
    );
  }
  if (!app) app = initializeApp(firebaseConfig);
  return app;
}

export function getAuthClient(): Auth {
  if (!authInstance) authInstance = getAuth(ensureApp());
  return authInstance;
}

export function getDb(): Firestore {
  if (!dbInstance) dbInstance = getFirestore(ensureApp());
  return dbInstance;
}
