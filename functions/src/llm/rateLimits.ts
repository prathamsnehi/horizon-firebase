import { RateWindowConfig } from "../types";

/**
 * Per-MODEL free-tier rate limits, keyed by `${providerId}:${modelId}`.
 *
 * Rate limits are metered per model, not per provider — e.g. on Groq the 8B
 * model allows 14,400 RPD but the 70B only 1,000 RPD, and on Gemini flash-lite
 * allows 1,500 RPD vs flash's 250. So every model the router can pick has its
 * own entry here.
 *
 * A model is eligible for a request only if ALL its windows have headroom.
 * Values are SAFETY-MARGINED (~90%) below the published caps so we back off
 * before the provider hard-rejects. They drift and vary by account — CONFIRM in
 * each provider's console/dashboard and adjust.
 *
 * Sources (official docs, mid-2026):
 *  - Groq:     https://console.groq.com/docs/rate-limits
 *      openai/gpt-oss-20b   → 30 RPM, 1,000 RPD, 8K TPM, 200K TPD
 *      openai/gpt-oss-120b  → 30 RPM, 1,000 RPD, 8K TPM, 200K TPD
 *      (llama-3.x models dropped — they don't support json_schema structured output)
 *  - Gemini:   from the project's AI Studio rate-limit dashboard (authoritative)
 *      gemini-3.1-flash-lite  → 15 RPM,  500 RPD, 250K TPM
 *      gemini-3.5-flash       →  5 RPM,   20 RPD, 250K TPM  (RPD is tiny — failover critical)
 *      Daily quota resets midnight Pacific.
 *  - Cerebras: https://inference-docs.cerebras.ai/support/rate-limits
 *      gpt-oss-120b (free)    → 5 RPM, 30K TPM, 1M TPD  (daily is token-limited, not request-limited)
 *  - Mistral:  free tier (from console) — rate-limited per SECOND, not per minute:
 *      mistral-small-latest (mistral-small-2603) → 0.83 RPS, 50K TPM
 *      mistral-medium-latest                     → 0.83 RPS, 25K TPM
 *      ~1B tokens/month cap. Modeled as an RPS bucket (~0.67 rps sustained, small burst).
 *
 * Token-based limits (TPM/TPD) are not modeled here; the router's
 * `penalizeRateKey` on a 429 is the backstop for those.
 */
export const MODEL_RATE_LIMITS: Record<string, RateWindowConfig[]> = {
  // --- Gemini ---
  "gemini:gemini-3.1-flash-lite": [
    { kind: "rpm", limit: 13, windowMs: 60_000, strategy: "bucket" },
    { kind: "rpd", limit: 450, windowMs: 86_400_000, strategy: "fixed" },
  ],
  "gemini:gemini-3.5-flash": [
    { kind: "rpm", limit: 4, windowMs: 60_000, strategy: "bucket" },
    { kind: "rpd", limit: 18, windowMs: 86_400_000, strategy: "fixed" },
  ],

  // --- Groq (gpt-oss models: 30 RPM, 1K RPD each; token limits not modeled) ---
  "groq:openai/gpt-oss-20b": [
    { kind: "rpm", limit: 27, windowMs: 60_000, strategy: "bucket" },
    { kind: "rpd", limit: 900, windowMs: 86_400_000, strategy: "fixed" },
  ],
  "groq:openai/gpt-oss-120b": [
    { kind: "rpm", limit: 27, windowMs: 60_000, strategy: "bucket" },
    { kind: "rpd", limit: 900, windowMs: 86_400_000, strategy: "fixed" },
  ],

  // --- Cerebras (daily cap is token-based; penalty handles TPD) ---
  "cerebras:gpt-oss-120b": [
    { kind: "rpm", limit: 4, windowMs: 60_000, strategy: "bucket" },
  ],

  // --- Mistral (per-second limited: 0.83 RPS; modeled ~0.67 rps, burst 2) ---
  "mistral:mistral-small-latest": [
    { kind: "rps", limit: 2, windowMs: 3_000, strategy: "bucket" },
  ],
  "mistral:mistral-medium-latest": [
    { kind: "rps", limit: 2, windowMs: 3_000, strategy: "bucket" },
  ],
};
