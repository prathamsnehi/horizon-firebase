import type { TransportationMode } from "../types";

/** 75 -> "1 hr 15 min", 45 -> "45 min", 120 -> "2 hr". */
export function formatMinutes(mins: number): string {
  if (!mins || mins <= 0) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} hr`;
  return `${h} hr ${m} min`;
}

/** 3.21 -> "3.2 mi", 0.4 -> "0.4 mi". */
export function formatMiles(miles?: number): string | null {
  if (miles == null || Number.isNaN(miles)) return null;
  if (miles < 0.1) return "Nearby";
  return `${miles.toFixed(1)} mi away`;
}

export const TRANSPORT_LABELS: Record<TransportationMode, string> = {
  walking: "Walking",
  publicTransport: "Public transit",
  car: "Driving",
  bike: "Biking",
  rideshare: "Rideshare",
};

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function titleCase(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}
