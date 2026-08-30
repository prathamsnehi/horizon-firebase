/**
 * External links for the marketing site. Single source of truth so every CTA
 * updates from one place.
 */
// The app is in beta, so this is a TestFlight invite rather than an App Store
// listing. Swap it for the App Store URL at public launch — every CTA reads it.
export const DOWNLOAD_URL = "https://testflight.apple.com/join/brUjqFkr";

/**
 * Analytics endpoint (functions/src/controllers/siteMetrics.ts). Hit with
 * `navigator.sendBeacon`, never the Firebase SDK — importing Firebase here would
 * pull it into the marketing bundle and undo the admin/marketing code split.
 *
 * Same-origin by way of a Hosting rewrite (firebase.json maps /api/track to the
 * trackEvent function): no CORS, no ad-blocker heuristics about third-party
 * beacon hosts, and no Cloud Run URL to hardcode. Empty string disables tracking.
 */
export const TRACK_EVENT_URL = "/api/track";
