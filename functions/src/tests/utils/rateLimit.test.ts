import { evaluateRateWindow, RATE_WINDOW_MS } from "../../utils/rateLimit";

describe("evaluateRateWindow (24h rolling window)", () => {
  const now = 1_700_000_000_000;

  it("allows when never used", () => {
    expect(evaluateRateWindow(null, now)).toEqual({ allowed: true });
  });

  it("denies within the window and reports retryAtMs = last + 24h", () => {
    const last = now - (RATE_WINDOW_MS - 1000); // 1s short of a full day ago
    const result = evaluateRateWindow(last, now);
    expect(result.allowed).toBe(false);
    expect(result.retryAtMs).toBe(last + RATE_WINDOW_MS);
  });

  it("allows exactly at the window boundary", () => {
    const last = now - RATE_WINDOW_MS;
    expect(evaluateRateWindow(last, now)).toEqual({ allowed: true });
  });

  it("allows after the window has fully elapsed", () => {
    const last = now - (RATE_WINDOW_MS + 60_000);
    expect(evaluateRateWindow(last, now)).toEqual({ allowed: true });
  });
});
