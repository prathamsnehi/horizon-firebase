import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { getDb } from "./firebase";

/**
 * Reader for the marketing-site counters written by the `trackEvent` function
 * (functions/src/controllers/siteMetrics.ts).
 *
 * One document per UTC day, aggregate only — there are no per-visitor records to
 * read, by design. Admin-side, so importing Firebase here is fine: this module is
 * only reachable from the lazily-loaded /admin chunk.
 */
export interface SiteDay {
  /** YYYY-MM-DD (UTC), also the document id. */
  date: string;
  pageviews: number;
  visits: number;
  downloadClicks: number;
  /** Referrer hostname → count. Dots are stored as underscores (Firestore paths). */
  referrers: Record<string, number>;
  devices: { mobile: number; desktop: number };
}

export interface SiteTotals {
  days: SiteDay[];
  pageviews: number;
  visits: number;
  downloadClicks: number;
  /** downloadClicks / visits, or null when there is nothing to divide by. */
  conversion: number | null;
  /** Referrer hostnames, busiest first. */
  topReferrers: { host: string; count: number }[];
  devices: { mobile: number; desktop: number };
}

/** UTC day keys for the last `n` days, oldest first — including days with no data. */
function recentDayKeys(n: number): string[] {
  const out: string[] = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

const num = (v: unknown) => (typeof v === "number" && isFinite(v) ? v : 0);

export async function fetchSiteMetrics(days = 30): Promise<SiteTotals> {
  const keys = recentDayKeys(days);
  const snap = await getDocs(
    query(
      collection(getDb(), "site_metrics"),
      where("date", ">=", keys[0]),
      orderBy("date", "asc")
    )
  );

  const byDate = new Map<string, SiteDay>();
  for (const d of snap.docs) {
    const raw = d.data() as Record<string, unknown>;
    const refs = (raw.referrers ?? {}) as Record<string, number>;
    const dev = (raw.devices ?? {}) as Record<string, number>;
    byDate.set(d.id, {
      date: d.id,
      pageviews: num(raw.pageviews),
      visits: num(raw.visits),
      downloadClicks: num(raw.downloadClicks),
      // Stored with dots escaped as underscores; restore for display.
      referrers: Object.fromEntries(
        Object.entries(refs).map(([k, v]) => [k.replace(/_/g, "."), num(v)])
      ),
      devices: { mobile: num(dev.mobile), desktop: num(dev.desktop) },
    });
  }

  // Zero-fill so the chart shows quiet days rather than skipping them.
  const list: SiteDay[] = keys.map(
    (date) =>
      byDate.get(date) ?? {
        date,
        pageviews: 0,
        visits: 0,
        downloadClicks: 0,
        referrers: {},
        devices: { mobile: 0, desktop: 0 },
      }
  );

  const refTotals = new Map<string, number>();
  let pageviews = 0;
  let visits = 0;
  let downloadClicks = 0;
  const devices = { mobile: 0, desktop: 0 };

  for (const d of list) {
    pageviews += d.pageviews;
    visits += d.visits;
    downloadClicks += d.downloadClicks;
    devices.mobile += d.devices.mobile;
    devices.desktop += d.devices.desktop;
    for (const [host, n] of Object.entries(d.referrers)) {
      refTotals.set(host, (refTotals.get(host) ?? 0) + n);
    }
  }

  return {
    days: list,
    pageviews,
    visits,
    downloadClicks,
    conversion: visits > 0 ? downloadClicks / visits : null,
    topReferrers: [...refTotals.entries()]
      .map(([host, count]) => ({ host, count }))
      .sort((a, b) => b.count - a.count),
    devices,
  };
}
