import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchSample } from "../../lib/samples";
import { json, ms, timestamp } from "../../lib/format";
import {
  spanAttemptLog,
  spanMetaString,
  type GenerationSample,
  type TraceSpan,
} from "../../types";

/**
 * The waterfall. Each span is a bar positioned by `offsetMs` and sized by
 * `latencyMs` against a single shared timeline, so the shape of a slow run is
 * visible before reading any number — and the failover chain is right there
 * when the answer is "the primary model was down".
 */

/** Stage → categorical slot. Identity is fixed per stage, never assigned by
 *  rank, so a stage keeps its color as the mix changes between runs. */
const STAGE_FILL: Record<string, string> = {
  request: "bg-s6",
  "ratelimit.reserve": "bg-s7",
  "cache.lookup": "bg-s5",
  scout: "bg-s1",
  "maps.resolve": "bg-s3",
  enrich: "bg-s6",
  writer: "bg-s2",
  generic: "bg-s4",
  planner: "bg-s1",
  moderation: "bg-s7",
  "photos.attach": "bg-s5",
  "ratelimit.commit": "bg-s7",
};

export default function LogDetail() {
  const { id } = useParams();
  const [sample, setSample] = useState<GenerationSample | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    if (!id) return;
    fetchSample(id)
      .then((found) => {
        if (!found) setError("No sample with that id.");
        else setSample(found);
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : String(err))
      );
  }, [id]);

  if (error) {
    return (
      <div className="card border-critical/40 p-4 text-tiny text-critical">
        {error}
      </div>
    );
  }
  if (!sample) {
    return <p className="py-16 text-center text-tiny text-muted">Loading…</p>;
  }

  const spans = [...(sample.spans ?? [])].sort((a, b) => a.seq - b.seq);
  // The timeline must span the whole run, not just the last span's start.
  const span_end = Math.max(
    sample.totalLatencyMs,
    ...spans.map((s) => s.offsetMs + s.latencyMs)
  );
  const scale = Math.max(1, span_end);

  return (
    <div className="space-y-5">
      <div>
        <Link
          to="/admin/logs"
          className="ring-focus text-micro text-muted hover:text-fg"
        >
          ← All samples
        </Link>
        <h1 className="mt-2 flex flex-wrap items-baseline gap-3 text-base font-semibold">
          <span className="font-mono">{sample.type}</span>
          <span className="chip border-line text-muted">{sample.outcome}</span>
          <span className="nums text-tiny font-normal text-muted">
            {ms(sample.totalLatencyMs)} · {timestamp(sample.startedAt)}
          </span>
        </h1>
        <p className="mt-1 font-mono text-micro text-muted">{sample.traceId}</p>
      </div>

      {sample.error && (
        <div className="card border-critical/40 p-4">
          <div className="text-micro font-medium uppercase tracking-wide text-critical">
            Error
          </div>
          <p className="mt-1.5 font-mono text-tiny leading-relaxed text-dim">
            {sample.error}
          </p>
        </div>
      )}

      <section className="card p-4">
        <h2 className="mb-3 text-tiny font-semibold text-dim">Waterfall</h2>
        <div className="space-y-1">
          {spans.map((span, i) => {
            const left = (span.offsetMs / scale) * 100;
            const width = Math.max((span.latencyMs / scale) * 100, 0.6);
            const isOpen = open === i;
            return (
              <div key={span.seq}>
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="ring-focus grid w-full grid-cols-[10rem_1fr_4.5rem] items-center gap-3 rounded-md px-1 py-1 text-left hover:bg-raised"
                >
                  <span className="truncate font-mono text-micro text-dim">
                    {span.stage}
                  </span>
                  <span className="relative h-2.5 w-full rounded-mark bg-raised">
                    <span
                      className={`absolute top-0 h-full rounded-mark ${
                        STAGE_FILL[span.stage] ?? "bg-s1"
                      }`}
                      style={{ left: `${left}%`, width: `${width}%` }}
                      title={`${span.stage}: ${ms(span.latencyMs)} at +${ms(span.offsetMs)}`}
                    />
                  </span>
                  <span className="nums text-right text-micro text-muted">
                    {ms(span.latencyMs)}
                  </span>
                </button>

                {isOpen && <SpanDetail span={span} />}
              </div>
            );
          })}
        </div>
      </section>

      {sample.result != null && (
        <section className="card p-4">
          <h2 className="mb-3 text-tiny font-semibold text-dim">Result</h2>
          <Json value={sample.result} />
        </section>
      )}
    </div>
  );
}

function SpanDetail({ span }: { span: TraceSpan }) {
  const attempts = spanAttemptLog(span);
  const provider = spanMetaString(span, "provider");
  const model = spanMetaString(span, "model");

  return (
    <div className="ml-2 mb-2 space-y-3 border-l border-line pl-4 pt-2">
      {(provider || model) && (
        <p className="font-mono text-micro text-muted">
          {provider} / {model}
        </p>
      )}

      {attempts.length > 0 && (
        <div>
          <div className="mb-1.5 text-micro font-medium uppercase tracking-wide text-muted">
            Failover chain
          </div>
          <ol className="space-y-1">
            {attempts.map((attempt, i) => (
              <li key={i} className="flex flex-wrap items-baseline gap-2 text-micro">
                <span
                  className={`chip ${
                    attempt.ok
                      ? "border-good/40 text-good"
                      : "border-critical/40 text-critical"
                  }`}
                >
                  {attempt.ok ? "ok" : "failed"}
                </span>
                <span className="font-mono text-dim">
                  {attempt.provider}/{attempt.model}
                </span>
                <span className="nums text-muted">{ms(attempt.latencyMs)}</span>
                {attempt.error && (
                  <span className="w-full truncate font-mono text-muted">
                    {attempt.error}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}

      {span.input != null && <Labeled label="Input" value={span.input} />}
      {span.output != null && <Labeled label="Output" value={span.output} />}
      {span.meta != null && <Labeled label="Meta" value={span.meta} />}
    </div>
  );
}

function Labeled({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <div className="mb-1 text-micro font-medium uppercase tracking-wide text-muted">
        {label}
      </div>
      <Json value={value} />
    </div>
  );
}

function Json({ value }: { value: unknown }) {
  return (
    <pre className="max-h-80 overflow-auto rounded-lg bg-page p-3 font-mono text-micro leading-relaxed text-dim">
      {json(value)}
    </pre>
  );
}
