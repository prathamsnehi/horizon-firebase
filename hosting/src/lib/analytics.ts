/**
 * Marketing-site analytics — deliberately tiny.
 *
 * Everything goes through `navigator.sendBeacon` to a plain Cloud Function
 * endpoint. The Firebase SDK is never imported here: pulling it into the `/`
 * route would undo the code split that keeps ~450KB of Firebase out of the
 * bundle every visitor downloads.
 *
 * Nothing identifying is sent or stored. The server keeps per-day counters only,
 * so one visit cannot be told apart from another. The single piece of client
 * state is a sessionStorage flag used to avoid counting one person's session
 * repeatedly; it is cleared when the tab closes and is never sent anywhere.
 */
import { TRACK_EVENT_URL } from "./links";

const SESSION_KEY = "hz_seen";

function send(event: "view" | "visit" | "download", extra?: Record<string, string>) {
  if (!TRACK_EVENT_URL) return;
  try {
    const url = new URL(TRACK_EVENT_URL, location.origin);
    url.searchParams.set("e", event);
    url.searchParams.set(
      "dev",
      matchMedia?.("(pointer: coarse)").matches ? "mobile" : "desktop",
    );
    for (const [k, v] of Object.entries(extra ?? {})) url.searchParams.set(k, v);
    navigator.sendBeacon?.(url.toString());
  } catch {
    /* analytics must never break the page */
  }
}

/** Where this visitor came from, reduced to a bare hostname (never a full URL). */
function referrerHost(): string {
  try {
    if (!document.referrer) return "direct";
    const host = new URL(document.referrer).hostname;
    if (host === location.hostname) return "internal";
    return host;
  } catch {
    return "direct";
  }
}

/**
 * Count a page view, plus a visit on the first view of the browsing session.
 * Both are plain counters; the session flag exists only so one person reloading
 * the page doesn't read as many separate visitors.
 */
export function trackPageview() {
  send("view");
  let firstOfSession = true;
  try {
    firstOfSession = sessionStorage.getItem(SESSION_KEY) === null;
    if (firstOfSession) sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    // Private mode or storage disabled: fall back to counting the visit, which
    // slightly over-counts rather than silently losing the visitor.
  }
  if (firstOfSession) send("visit", { ref: referrerHost() });
}

/** Count a press of the download button. Fire-and-forget; never blocks the link. */
export function trackDownloadClick() {
  send("download");
}
