import { useState, type ReactNode } from "react";
import { clockLabel } from "../lib/format";

/*
 * Chart primitives, hand-built.
 *
 * Every visual here is a stat tile, a bar, or a stacked bar — forms that are a
 * few divs each — so a charting library would add a dependency and a bundle
 * without adding capability. Mark specs follow the dataviz method: 4px rounded
 * data-ends anchored to the baseline, a 2px surface gap between adjacent fills,
 * recessive grid and axis ink, and a hover layer on every plotted mark.
 *
 * Colors arrive as Tailwind classes from the caller (`s1`, `good`, `q95`, …) so
 * the encoding decision stays with the chart that owns the data's meaning.
 */

// ---------------------------------------------------------------------------
// Stat tile — the right answer when the data's job is a single headline.
// ---------------------------------------------------------------------------

export function StatTile({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  /** A status tone. Always accompanies the label — never the only signal. */
  tone?: "good" | "warning" | "critical" | "serious";
}) {
  const toneClass =
    tone === "good"
      ? "text-good"
      : tone === "warning"
        ? "text-warning"
        : tone === "critical"
          ? "text-critical"
          : tone === "serious"
            ? "text-serious"
            : "text-fg";

  return (
    <div className="card p-4">
      <div className="text-micro font-medium uppercase tracking-wide text-muted">
        {label}
      </div>
      <div className={`mt-1.5 text-2xl font-semibold ${toneClass}`}>{value}</div>
      {sub && <div className="mt-1 text-micro text-muted nums">{sub}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Legend — present whenever two or more series share a plot, so identity is
// never carried by color alone.
// ---------------------------------------------------------------------------

export interface LegendItem {
  label: string;
  /** Tailwind background class, e.g. "bg-s1". */
  swatch: string;
}

export function Legend({ items }: { items: LegendItem[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5">
          <span className={`h-2.5 w-2.5 rounded-sm ${item.swatch}`} aria-hidden />
          <span className="text-micro text-dim">{item.label}</span>
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Proportion meter — one ratio, labeled with both the percentage and the counts
// behind it, because a rate over five samples is not the same claim as a rate
// over five hundred.
// ---------------------------------------------------------------------------

export function Meter({
  value,
  fill = "bg-s1",
}: {
  value: number | null;
  fill?: string;
}) {
  return (
    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-mark bg-raised">
      {value != null && (
        <div
          className={`h-full rounded-mark ${fill}`}
          style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Horizontal bars — magnitude compared across a handful of named categories.
// Supports one or two series (a second series gets its own row per category so
// both stay anchored to a shared baseline; never a second x-axis).
// ---------------------------------------------------------------------------

export interface HBarSeries {
  label: string;
  /** Tailwind background class. */
  fill: string;
  values: (number | null)[];
}

export function HBarChart({
  categories,
  series,
  format,
  emptyNote = "No data in this window",
}: {
  categories: string[];
  series: HBarSeries[];
  format: (value: number) => string;
  emptyNote?: string;
}) {
  const max = Math.max(
    0,
    ...series.flatMap((s) => s.values.map((v) => v ?? 0))
  );
  const hasData = max > 0;

  return (
    <div>
      {series.length > 1 && (
        <div className="mb-3">
          <Legend
            items={series.map((s) => ({ label: s.label, swatch: s.fill }))}
          />
        </div>
      )}

      {!hasData ? (
        <p className="py-6 text-center text-tiny text-muted">{emptyNote}</p>
      ) : (
        <div className="space-y-3">
          {categories.map((category, i) => (
            <div key={category}>
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <span className="font-mono text-micro text-dim">{category}</span>
                <span className="nums text-micro text-muted">
                  {series
                    .map((s) => (s.values[i] == null ? "—" : format(s.values[i]!)))
                    .join("  ·  ")}
                </span>
              </div>
              {/* One row per series, sharing a baseline and a scale. */}
              <div className="space-y-[2px]">
                {series.map((s) => (
                  <div key={s.label} className="h-2 w-full rounded-mark bg-raised">
                    <div
                      className={`h-full rounded-mark ${s.fill}`}
                      style={{ width: `${((s.values[i] ?? 0) / max) * 100}%` }}
                      title={`${category} · ${s.label}: ${
                        s.values[i] == null ? "—" : format(s.values[i]!)
                      }`}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Time buckets — volume over the window with failures stacked on top, so the
// column height stays the true total rather than splitting attention across two
// scales.
// ---------------------------------------------------------------------------

export function TimeBars({
  buckets,
}: {
  buckets: { start: number; total: number; errors: number }[];
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...buckets.map((b) => b.total));
  const active = hover != null ? buckets[hover] : null;

  return (
    <div>
      <div className="mb-3">
        <Legend
          items={[
            { label: "Succeeded", swatch: "bg-s1" },
            { label: "Failed", swatch: "bg-critical" },
          ]}
        />
      </div>

      <div className="relative">
        {/* Tooltip. Reserved height so the chart never reflows on hover. */}
        <div className="mb-1 h-4 text-micro text-dim nums">
          {active && (
            <span>
              {clockLabel(active.start)} — {active.total} run
              {active.total === 1 ? "" : "s"}
              {active.errors > 0 && (
                <span className="text-critical"> · {active.errors} failed</span>
              )}
            </span>
          )}
        </div>

        <div className="flex h-28 items-end gap-[2px]">
          {buckets.map((bucket, i) => {
            const ok = bucket.total - bucket.errors;
            return (
              <div
                key={bucket.start}
                className="group relative flex h-full flex-1 cursor-default flex-col justify-end"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              >
                {/* Hit target spans the full column height, not just the mark. */}
                <div className="absolute inset-0" aria-hidden />
                {bucket.errors > 0 && (
                  <div
                    className="w-full rounded-t-mark bg-critical"
                    style={{ height: `${(bucket.errors / max) * 100}%` }}
                  />
                )}
                <div
                  className={`w-full bg-s1 ${
                    bucket.errors > 0 ? "mt-[2px]" : "rounded-t-mark"
                  } ${ok === 0 ? "hidden" : ""}`}
                  style={{ height: `${(ok / max) * 100}%` }}
                />
                {bucket.total === 0 && (
                  <div className="h-[2px] w-full rounded-mark bg-grid" />
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-1.5 flex justify-between text-micro text-muted nums">
          <span>{clockLabel(buckets[0]?.start ?? Date.now())}</span>
          <span>now</span>
        </div>
      </div>
    </div>
  );
}
