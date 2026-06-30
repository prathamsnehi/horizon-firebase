import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
} from "firebase/app-check";
import { getFunctions, type Functions } from "firebase/functions";

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const region = import.meta.env.VITE_FUNCTIONS_REGION || "us-central1";
const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

// Local dev: register a debug token in the Firebase console (App Check ->
// your web app -> Manage debug tokens) and put it in .env.local so localhost
// can obtain valid App Check tokens.
if (import.meta.env.DEV && import.meta.env.VITE_APPCHECK_DEBUG_TOKEN) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN =
    import.meta.env.VITE_APPCHECK_DEBUG_TOKEN;
}

let app: FirebaseApp | null = null;
let functions: Functions | null = null;

/** True when the minimum Firebase web config is present. */
export function isFirebaseConfigured(): boolean {
  return Boolean(config.apiKey && config.projectId && config.appId);
}

/**
 * Lazily initialize Firebase, App Check, and Functions. App Check must be
 * initialized after initializeApp and before getFunctions so its token is
 * attached to callable requests.
 */
export function getAppFunctions(): Functions {
  if (!isFirebaseConfigured()) {
    throw new Error(
      "Firebase is not configured. Add VITE_FIREBASE_* values to frontend/.env.local."
    );
  }
  if (!app) {
    app = initializeApp(config);

    // Guard so dev/mock builds without a site key don't crash; once the
    // backend enforces App Check this key must be set in production.
    if (recaptchaSiteKey) {
      initializeAppCheck(app, {
        // reCAPTCHA Enterprise key (created in Google Cloud console).
        provider: new ReCaptchaEnterpriseProvider(recaptchaSiteKey),
        isTokenAutoRefreshEnabled: true,
      });
    } else if (import.meta.env.PROD) {
      console.warn(
        "[firebase] VITE_RECAPTCHA_SITE_KEY is missing — App Check is not initialized. " +
          "Calls will fail once the backend enforces App Check."
      );
    }

    functions = getFunctions(app, region);
  }
  return functions!;
}
