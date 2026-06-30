import { Fragment, useState } from "react";
import {
  Copy,
  Trash2,
  X,
  Check,
  ChevronRight,
  ChevronDown,
  Snowflake,
} from "lucide-react";
import { Button } from "../../components/ui/Button";
import { useGenLog, type GenLogEntry } from "../../lib/genLog";

function fmtSeconds(ms: number) {
  return `${(ms / 1000).toFixed(2)}s`;
}

function fmtTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString([], { month: "short", day: "numeric" });
}

const COL_COUNT = 9;

export default function Dev() {
  const entries = useGenLog((s) => s.entries);
  const setNote = useGenLog((s) => s.setNote);
  const removeEntry = useGenLog((s) => s.removeEntry);
  const clear = useGenLog((s) => s.clear);
  const [copied, setCopied] = useState(false);

  const liveOk = entries.filter(
    (e) => e.mode === "live" && e.status === "success"
  );
  const durations = liveOk.map((e) => e.durationMs);
  const avg = durations.length
    ? durations.reduce((a, b) => a + b, 0) / durations.length
    : 0;
  const min = durations.length ? Math.min(...durations) : 0;
  const max = durations.length ? Math.max(...durations) : 0;

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(entries, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may be unavailable; ignore */
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8 sm:py-12">
      <div className="mb-7 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-title1 font-bold tracking-tight text-foreground">
            Developer
          </h1>
          <p className="mt-1 text-muted-foreground">
            Generation timing log. Each batch request is recorded so you can
            compare runtimes across backend changes. Expand a live run to see
            the per-stage breakdown. Stored locally.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={copyJson}
            disabled={entries.length === 0}
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy JSON"}
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={clear}
            disabled={entries.length === 0}
          >
            <Trash2 className="h-4 w-4" />
            Clear
          </Button>
        </div>
      </div>

      {/* Summary over successful live runs */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Live runs" value={String(liveOk.length)} />
        <Stat label="Avg" value={liveOk.length ? fmtSeconds(avg) : "—"} />
        <Stat label="Fastest" value={liveOk.length ? fmtSeconds(min) : "—"} />
        <Stat label="Slowest" value={liveOk.length ? fmtSeconds(max) : "—"} />
      </div>

      {entries.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border py-16 text-center text-muted-foreground">
          No runs recorded yet. Generate a batch and it'll show up here.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[720px] border-collapse text-left text-subheadline">
            <thead>
              <tr className="border-b border-border bg-surface-muted/50 text-caption uppercase tracking-wide text-muted-foreground">
                <Th className="w-8" />
                <Th>When</Th>
                <Th>Mode</Th>
                <Th>City</Th>
                <Th className="text-right">Req → Ret</Th>
                <Th className="text-right">Duration</Th>
                <Th>Status</Th>
                <Th>Note</Th>
                <Th className="text-right" />
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <Row
                  key={e.id}
                  entry={e}
                  onNote={(note) => setNote(e.id, note)}
                  onRemove={() => removeEntry(e.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Row({
  entry: e,
  onNote,
  onRemove,
}: {
  entry: GenLogEntry;
  onNote: (note: string) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const expandable = !!e.timings;

  return (
    <Fragment>
      <tr className="border-b border-border/60 last:border-0 hover:bg-surface-muted/30">
        <Td>
          {expandable ? (
            <button
              onClick={() => setOpen((o) => !o)}
              aria-label={open ? "Collapse" : "Expand breakdown"}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {open ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          ) : (
            <span className="block h-4 w-4" />
          )}
        </Td>
        <Td>
          <span className="font-medium text-foreground">
            {fmtTime(e.startedAt)}
          </span>
          <span className="ml-2 text-caption text-muted-foreground">
            {fmtDate(e.startedAt)}
          </span>
        </Td>
        <Td>
          <span
            className={
              e.mode === "live"
                ? "rounded-full bg-primary/15 px-2 py-0.5 text-caption font-semibold text-primary"
                : "rounded-full bg-surface-muted px-2 py-0.5 text-caption font-semibold text-muted-foreground"
            }
          >
            {e.mode}
          </span>
          {e.timings?.coldStart && (
            <span
              title="Cold start — this request booted a fresh container"
              className="ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-moderate/15 px-1.5 py-0.5 text-caption font-semibold text-moderate"
            >
              <Snowflake className="h-3 w-3" />
              cold
            </span>
          )}
        </Td>
        <Td className="text-muted-foreground">{e.city || "—"}</Td>
        <Td className="text-right tabular-nums text-muted-foreground">
          {e.requestedCount} → {e.returnedCount}
        </Td>
        <Td className="text-right">
          <span className="font-mono font-semibold tabular-nums text-foreground">
            {fmtSeconds(e.durationMs)}
          </span>
        </Td>
        <Td>
          {e.status === "success" ? (
            <span className="inline-flex items-center gap-1 text-easy">
              <Check className="h-4 w-4" /> ok
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1 text-extreme"
              title={e.errorMessage}
            >
              <X className="h-4 w-4" /> error
            </span>
          )}
        </Td>
        <Td>
          <input
            type="text"
            defaultValue={e.note ?? ""}
            onBlur={(ev) => onNote(ev.target.value)}
            placeholder="tag this run…"
            className="w-40 rounded-lg border border-border bg-surface px-2.5 py-1 text-caption text-foreground outline-none focus:border-primary"
          />
        </Td>
        <Td className="text-right">
          <button
            onClick={onRemove}
            aria-label="Delete row"
            className="text-muted-foreground transition-colors hover:text-extreme"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </Td>
      </tr>
      {open && e.timings && (
        <tr className="border-b border-border/60 bg-surface-muted/20">
          <td colSpan={COL_COUNT} className="px-4 py-4">
            <Breakdown roundTripMs={e.durationMs} timings={e.timings} />
          </td>
        </tr>
      )}
    </Fragment>
  );
}

const SEGMENT_STYLES: { key: string; label: string; cls: string }[] = [
  { key: "scoutMs", label: "Scout", cls: "bg-easy" },
  { key: "mapsMs", label: "Maps", cls: "bg-moderate" },
  { key: "writerMs", label: "Writer", cls: "bg-primary" },
  { key: "genericFallbackMs", label: "Fallback", cls: "bg-hard" },
  { key: "serverOther", label: "Server other", cls: "bg-muted-foreground/30" },
  { key: "overhead", label: "Network + boot", cls: "bg-foreground/20" },
];

function Breakdown({
  roundTripMs,
  timings,
}: {
  roundTripMs: number;
  timings: NonNullable<GenLogEntry["timings"]>;
}) {
  const stageSum =
    timings.scoutMs +
    timings.mapsMs +
    timings.writerMs +
    timings.genericFallbackMs;
  const serverOther = Math.max(0, timings.totalServerMs - stageSum);
  // Client round-trip minus server time = network transit + (cold) container boot.
  const overhead = Math.max(0, roundTripMs - timings.totalServerMs);

  const values: Record<string, number> = {
    scoutMs: timings.scoutMs,
    mapsMs: timings.mapsMs,
    writerMs: timings.writerMs,
    genericFallbackMs: timings.genericFallbackMs,
    serverOther,
    overhead,
  };

  const total = Math.max(roundTripMs, 1);
  const segments = SEGMENT_STYLES.map((s) => ({
    ...s,
    ms: values[s.key],
    pct: (values[s.key] / total) * 100,
  })).filter((s) => s.ms > 0);

  return (
    <div className="space-y-3">
      {/* Stacked bar spans the full client round-trip */}
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-surface-muted">
        {segments.map((s) => (
          <div
            key={s.key}
            className={s.cls}
            style={{ width: `${s.pct}%` }}
            title={`${s.label}: ${fmtSeconds(s.ms)} (${s.pct.toFixed(0)}%)`}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-caption">
        {segments.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-sm ${s.cls}`} />
            <span className="text-muted-foreground">{s.label}</span>
            <span className="font-mono tabular-nums text-foreground">
              {fmtSeconds(s.ms)}
            </span>
            <span className="text-muted-foreground/70">
              {s.pct.toFixed(0)}%
            </span>
          </span>
        ))}
      </div>

      {/* Totals line */}
      <p className="text-caption text-muted-foreground">
        Server{" "}
        <span className="font-mono text-foreground">
          {fmtSeconds(timings.totalServerMs)}
        </span>{" "}
        · Network + boot{" "}
        <span className="font-mono text-foreground">{fmtSeconds(overhead)}</span>{" "}
        · Round trip{" "}
        <span className="font-mono text-foreground">
          {fmtSeconds(roundTripMs)}
        </span>
        {timings.coldStart && (
          <span className="ml-2 text-moderate">· cold start</span>
        )}
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface/40 px-4 py-3">
      <p className="text-caption uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-mono text-title3 font-bold tabular-nums text-foreground">
        {value}
      </p>
    </div>
  );
}

function Th({
  children,
  className = "",
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return <th className={`px-4 py-3 font-semibold ${className}`}>{children}</th>;
}

function Td({
  children,
  className = "",
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-4 py-3 align-middle ${className}`}>{children}</td>;
}
