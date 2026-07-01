import { advanceWindow, consumeWindow } from "../../llm/rateMath";
import { RateWindowConfig } from "../../types";

const rpm: RateWindowConfig = {
  kind: "rpm",
  limit: 30,
  windowMs: 60_000,
  strategy: "bucket",
};
const rpd: RateWindowConfig = {
  kind: "rpd",
  limit: 100,
  windowMs: 86_400_000,
  strategy: "fixed",
};

describe("advanceWindow — bucket", () => {
  it("starts full when no prior state", () => {
    const a = advanceWindow(rpm, undefined, 1000);
    expect(a.hasHeadroom).toBe(true);
    expect(a.remaining).toBe(30);
  });

  it("refills proportionally to elapsed time", () => {
    const now = 1_000_000;
    // Fully drained a whole window ago -> should refill to capacity.
    const a = advanceWindow(rpm, { tokens: 0, lastRefillMs: now - 60_000 }, now);
    expect(Math.round(a.remaining)).toBe(30);
  });

  it("caps refill at the limit", () => {
    const now = 1_000_000;
    const a = advanceWindow(rpm, { tokens: 20, lastRefillMs: now - 600_000 }, now);
    expect(a.remaining).toBe(30);
  });

  it("reports no headroom when below one token", () => {
    const a = advanceWindow(rpm, { tokens: 0.4, lastRefillMs: 1000 }, 1000);
    expect(a.hasHeadroom).toBe(false);
  });
});

describe("advanceWindow — fixed window", () => {
  it("resets the counter after the window elapses (no smooth refill)", () => {
    const now = 100_000_000;
    const a = advanceWindow(
      rpd,
      { count: 100, windowStartMs: now - 86_400_001 },
      now
    );
    expect(a.state).toEqual({ count: 0, windowStartMs: now });
    expect(a.remaining).toBe(100);
  });

  it("does not reset within the window and can be exhausted", () => {
    const a = advanceWindow(rpd, { count: 100, windowStartMs: 1000 }, 2000);
    expect(a.hasHeadroom).toBe(false);
    expect(a.remaining).toBe(0);
  });
});

describe("consumeWindow", () => {
  it("decrements a bucket token", () => {
    expect(consumeWindow(rpm, { tokens: 5, lastRefillMs: 1 })).toEqual({
      tokens: 4,
      lastRefillMs: 1,
    });
  });

  it("increments a fixed-window counter", () => {
    expect(consumeWindow(rpd, { count: 5, windowStartMs: 1 })).toEqual({
      count: 6,
      windowStartMs: 1,
    });
  });
});
