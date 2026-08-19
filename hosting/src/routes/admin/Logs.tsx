import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { QueryDocumentSnapshot } from "firebase/firestore";
import { fetchSamplePage, type SampleFilters } from "../../lib/samples";
import { ms, relative, timestamp } from "../../lib/format";
import { spanMetaString, type GenerationSample, type TraceOutcome, type TraceType } from "../../types";

const PAGE_SIZE = 25;

const TYPES: (TraceType | "all")[] = ["all", "curated", "described", "pregen"];
const OUTCOMES: (TraceOutcome | "all")[] = [
  "all",
  "success",
  "rate_limited",
  "error",
  "invalid",
];

const OUTCOME_STYLE: Record<string, string> = {
  success: "border-good/40 text-good",
  rate_limited: "border-warning/40 text-warning",
  error: "border-critical/40 text-critical",
  invalid: "border-serious/40 text-serious",
};

export default function Logs() {
  const [type, setType] = useState<TraceType | "all">("all");
  const [outcome, setOutcome] = useState<TraceOutcome | "all">("all");
  const [samples, setSamples] = useState<GenerationSample[]>([]);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Firestore needs a composite index per (equality + orderBy) combination, so
  // the two filters are alternatives rather than combinable — picking one
  // clears the other.
  const filters: SampleFilters = {
    ...(type !== "all" ? { type } : {}),
    ...(type === "all" && outcome !== "all" ? { outcome } : {}),
  };

  const load = useCallback(
    async (after?: QueryDocumentSnapshot) => {
      setLoading(true);
      setError(null);
      try {
        const page = await fetchSamplePage(filters, PAGE_SIZE, after);
        setSamples((prev) => (after ? [...prev, ...page.samples] : page.samples));
        setCursor(page.cursor);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [type, outcome]
  );

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <h1 className="text-base font-semibold">Generation samples</h1>

      <div className="flex flex-wrap items-center gap-4">
        <FilterGroup
          label="Type"
          options={TYPES}
          value={type}
          onChange={(v) => {
            setType(v as TraceType | "all");
            setOutcome("all");
          }}
        />
        <FilterGroup
          label="Outcome"
          options={OUTCOMES}
          value={outcome}
          onChange={(v) => {
            setOutcome(v as TraceOutcome | "all");
            setType("all");
          }}
        />
      </div>

      {error && (
        <div className="card border-critical/40 p-4 text-tiny text-critical">
          {error}
          {error.includes("index") && (
            <p className="mt-2 text-muted">
              Firestore needs the composite indexes from
              firestore/firestore.indexes.json — deploy them with{" "}
              <code>firebase deploy --only firestore:indexes</code>.
            </p>
          )}
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-tiny">
          <thead>
            <tr className="border-b border-line text-micro uppercase tracking-wide text-muted">
              <th className="px-4 py-2.5 text-left font-medium">When</th>
              <th className="px-4 py-2.5 text-left font-medium">Type</th>
              <th className="px-4 py-2.5 text-left font-medium">Outcome</th>
              <th className="px-4 py-2.5 text-right font-medium">Latency</th>
              <th className="px-4 py-2.5 text-right font-medium">Spans</th>
              <th className="px-4 py-2.5 text-left font-medium">Model</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {samples.map((sample) => (
              <tr key={sample.id} className="hover:bg-raised">
                <td className="px-4 py-2">
                  <Link
                    to={`/admin/logs/${sample.id}`}
                    className="ring-focus block text-dim hover:text-fg"
                    title={timestamp(sample.startedAt)}
                  >
                    {relative(sample.startedAt)}
                  </Link>
                </td>
                <td className="px-4 py-2 font-mono text-micro text-muted">
                  {sample.type}
                </td>
                <td className="px-4 py-2">
                  <span
                    className={`chip ${OUTCOME_STYLE[sample.outcome] ?? "text-muted"}`}
                  >
                    {sample.outcome}
                  </span>
                </td>
                <td className="nums px-4 py-2 text-right text-dim">
                  {ms(sample.totalLatencyMs)}
                </td>
                <td className="nums px-4 py-2 text-right text-muted">
                  {sample.spans?.length ?? 0}
                </td>
                <td className="px-4 py-2 font-mono text-micro text-muted">
                  {primaryModel(sample) ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {samples.length === 0 && !loading && (
          <p className="py-10 text-center text-tiny text-muted">
            No samples match these filters.
          </p>
        )}
        {loading && (
          <p className="py-6 text-center text-tiny text-muted">Loading…</p>
        )}
      </div>

      {cursor && !loading && (
        <button
          onClick={() => void load(cursor)}
          className="ring-focus w-full rounded-lg border border-line py-2 text-tiny font-medium text-dim hover:text-fg"
        >
          Load more
        </button>
      )}
    </div>
  );
}

/** The model that served the writer, else whichever LLM stage ran first. */
function primaryModel(sample: GenerationSample): string | undefined {
  const spans = sample.spans ?? [];
  const writer = spans.find((s) => s.stage === "writer");
  const any = spans.find((s) => spanMetaString(s, "model"));
  return spanMetaString(writer ?? any ?? spans[0] ?? ({} as never), "model");
}

function FilterGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-micro uppercase tracking-wide text-muted">{label}</span>
      <div className="flex gap-1 rounded-lg border border-line p-0.5">
        {options.map((option) => (
          <button
            key={option}
            onClick={() => onChange(option)}
            className={`ring-focus rounded-md px-2.5 py-1 text-micro font-medium transition-colors ${
              option === value ? "bg-raised text-fg" : "text-muted hover:text-dim"
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}
