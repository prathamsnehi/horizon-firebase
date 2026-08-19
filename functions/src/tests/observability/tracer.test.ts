// Mock the Firestore write so the tracer never touches the network / Admin SDK.
jest.mock("../../integrations/firestore", () => ({
  saveGenerationSample: jest.fn().mockResolvedValue(undefined),
}));

import {
  runTrace,
  span,
  recordSpan,
  currentTrace,
  setTraceField,
} from "../../observability/tracer";
import { saveGenerationSample } from "../../integrations/firestore";

const mockSaveSample = saveGenerationSample as jest.Mock;

describe("tracer", () => {
  beforeEach(() => mockSaveSample.mockClear());

  it("no-ops recordSpan/span with no active trace and never writes", async () => {
    expect(currentTrace()).toBeUndefined();
    expect(() => recordSpan("x", { latencyMs: 5 })).not.toThrow();
    const v = await span("y", async () => 42);
    expect(v).toBe(42);
    expect(mockSaveSample).not.toHaveBeenCalled();
  });

  it("records ordered spans and writes exactly one doc, returning the value", async () => {
    const ret = await runTrace({ type: "curated" }, async () => {
      recordSpan("a", { latencyMs: 1 });
      await span("b", async () => "r", {
        input: { x: 1 },
        onResult: () => ({ output: { y: 2 } }),
      });
      setTraceField({ result: { ok: true } });
      return "value";
    });

    expect(ret).toBe("value");
    expect(mockSaveSample).toHaveBeenCalledTimes(1);

    const doc = mockSaveSample.mock.calls[0][0];
    expect(doc.type).toBe("curated");
    // the record is anonymous by construction
    expect(doc.uid).toBeUndefined();
    expect(doc.outcome).toBe("success");
    expect(doc.result).toEqual({ ok: true });
    expect(doc.spans.map((s: any) => s.stage)).toEqual(["a", "b"]);
    expect(doc.spans.map((s: any) => s.seq)).toEqual([1, 2]);
    // offsets are monotonic non-decreasing
    const offsets = doc.spans.map((s: any) => s.offsetMs);
    expect(offsets[0]).toBeLessThanOrEqual(offsets[1]);
    expect(doc.spans[1].input).toEqual({ x: 1 });
    expect(doc.spans[1].output).toEqual({ y: 2 });
  });

  it("stamps outcome:error and rethrows, still writing one doc", async () => {
    await expect(
      runTrace({ type: "pregen" }, async () => {
        recordSpan("a", {});
        throw new Error("boom");
      })
    ).rejects.toThrow("boom");

    expect(mockSaveSample).toHaveBeenCalledTimes(1);
    const doc = mockSaveSample.mock.calls[0][0];
    expect(doc.outcome).toBe("error");
    expect(doc.error).toContain("boom");
  });

  it("isolates concurrent traces via AsyncLocalStorage", async () => {
    const run = (id: string) =>
      runTrace({ type: "curated" }, async () => {
        recordSpan("s1", { meta: { id } });
        await new Promise((r) => setTimeout(r, 5));
        recordSpan("s2", { meta: { id } });
        return id;
      });

    await Promise.all([run("A"), run("B")]);

    const docs = mockSaveSample.mock.calls.map((c) => c[0]);
    expect(docs).toHaveLength(2);
    for (const doc of docs) {
      const ids = new Set(doc.spans.map((s: any) => s.meta.id));
      // every span in a trace belongs to that one request — no cross-talk
      expect(ids.size).toBe(1);
    }
  });

  it("writes no sample at all when the outcome is blocked", async () => {
    await runTrace({ type: "described" }, async () => {
      recordSpan("request", { meta: { prompt: "x" } });
      setTraceField({ outcome: "blocked" });
    });

    // moderated text must never reach the corpus, not even as a bare record
    expect(mockSaveSample).not.toHaveBeenCalled();
  });
});
