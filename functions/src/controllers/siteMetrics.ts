import * as functions from "firebase-functions/v2";
import { recordSiteEvent, type SiteEvent } from "../integrations/firestore";
import { FUNCTIONS_REGION } from "../config";

/**
 * Analytics endpoint for the marketing site.
 *
 * The site is deliberately Firebase-free (that split is what keeps the Firebase
 * SDK out of the bundle every visitor downloads), so it cannot use the Analytics
 * or callable-function SDKs. Instead the page fires `navigator.sendBeacon` at
 * this plain HTTPS endpoint — no SDK, no cookie, fire-and-forget, and it still
 * lands even when the click immediately navigates away to TestFlight.
 *
 * Everything is sent as query params so the beacon stays a "simple" CORS request
 * with no preflight. Only aggregate per-day counters are written (see
 * recordSiteEvent): no identifier of any kind is stored, so there is nothing to
 * tie back to a person.
 *
 * The Origin check is a courtesy guard against casual inflation, not real
 * authentication — an open counter can always be spammed, so read the numbers as
 * trends rather than audited figures.
 */
const ALLOWED_ORIGINS = new Set([
  "https://usehorizon.app",
  "https://www.usehorizon.app",
  "https://horizon-sidequests.web.app",
  "https://horizon-sidequests.firebaseapp.com",
  "http://localhost:5174",
  "http://127.0.0.1:5174",
]);

const EVENTS = new Set<SiteEvent>(["view", "visit", "download"]);

/** Keep referrers to a short, bare hostname — never a full URL with a path or query. */
function cleanReferrer(raw: unknown): string | undefined {
  if (typeof raw !== "string" || !raw) return undefined;
  if (raw === "direct") return "direct";
  const host = raw.toLowerCase().replace(/^www\./, "");
  if (!/^[a-z0-9.-]{1,60}$/.test(host)) return undefined;
  return host;
}

export const trackEvent = functions.https.onRequest(
  { region: FUNCTIONS_REGION, maxInstances: 3, cors: false },
  async (req, res) => {
    // Requests arriving through the /api/track Hosting rewrite are same-origin,
    // where a browser may omit the Origin header entirely — so a missing Origin
    // is accepted. Present-but-unrecognised is rejected. This deters casual
    // inflation; it is not authentication, and cannot be.
    const origin = req.headers.origin;
    const allowed =
      origin === undefined || (typeof origin === "string" && ALLOWED_ORIGINS.has(origin));
    if (allowed && typeof origin === "string") {
      res.set("Access-Control-Allow-Origin", origin);
      res.set("Vary", "Origin");
    }

    if (req.method === "OPTIONS") {
      res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.set("Access-Control-Max-Age", "3600");
      res.status(204).send("");
      return;
    }
    // Answer 204 to everything: this is a beacon, and there is nothing useful to
    // report back to a caller that has already navigated away.
    if (req.method !== "POST" || !allowed) {
      res.status(204).send("");
      return;
    }

    const event = String(req.query.e ?? "") as SiteEvent;
    if (!EVENTS.has(event)) {
      res.status(204).send("");
      return;
    }
    const device = req.query.dev === "mobile" ? "mobile" : "desktop";

    try {
      await recordSiteEvent(event, {
        referrer: cleanReferrer(req.query.ref),
        device,
      });
    } catch (err) {
      functions.logger.warn("trackEvent: counter write failed", { event, err });
    }
    res.status(204).send("");
  },
);
