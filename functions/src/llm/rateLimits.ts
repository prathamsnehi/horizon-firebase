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
 *      llama-3.1-8b-instant   → 30 RPM, 14,400 RPD, 6K TPM, 500K TPD
 *      llama-3.3-70b-versatile→ 30 RPM,  1,000 RPD, 12K TPM, 100K TPD
 *  - Gemini:   https://ai.google.dev/gemini-api/docs/rate-limits (numbers via AI Studio dashboard)
 *      2.5-flash-lite class   → 30 RPM, 1,500 RPD, 1M TPM   (mapped to gemini-3.1-flash-lite)
 *      2.5-flash class        → 10 RPM,   250 RPD, 250K TPM (mapped to gemini-3.5-flash)
 *      Daily quota resets midnight Pacific.
 *  - Cerebras: https://inference-docs.cerebras.ai/support/rate-limits
 *      gpt-oss-120b (free)    → 5 RPM, 30K TPM, 1M TPD  (daily is token-limited, not request-limited)
 *  - Mistral:  free "Experiment" tier — exact RPM not published (check Admin Console → Limits);
 *      ~1B tokens/month. Conservative RPM below; lean on 429-penalty for the rest.
 *
 * Token-based limits (TPM/TPD) are not modeled here; the router's
 * `penalizeRateKey` on a 429 is the backstop for those.
 */
export const MODEL_RATE_LIMITS: Record<string, RateWindowConfig[]> = {
  // --- Gemini ---
  "gemini:gemini-3.1-flash-lite": [
    { kind: "rpm", limit: 27, windowMs: 60_000, strategy: "bucket" },
    { kind: "rpd", limit: 1_350, windowMs: 86_400_000, strategy: "fixed" },
  ],
  "gemini:gemini-3.5-flash": [
    { kind: "rpm", limit: 9, windowMs: 60_000, strategy: "bucket" },
    { kind: "rpd", limit: 225, windowMs: 86_400_000, strategy: "fixed" },
  ],

  // --- Groq ---
  "groq:llama-3.1-8b-instant": [
    { kind: "rpm", limit: 27, windowMs: 60_000, strategy: "bucket" },
    { kind: "rpd", limit: 13_000, windowMs: 86_400_000, strategy: "fixed" },
  ],
  "groq:llama-3.3-70b-versatile": [
    { kind: "rpm", limit: 27, windowMs: 60_000, strategy: "bucket" },
    { kind: "rpd", limit: 900, windowMs: 86_400_000, strategy: "fixed" },
  ],

  // --- Cerebras (daily cap is token-based; penalty handles TPD) ---
  "cerebras:gpt-oss-120b": [
    { kind: "rpm", limit: 4, windowMs: 60_000, strategy: "bucket" },
  ],

  // --- Mistral (RPM unpublished; conservative) ---
  "mistral:mistral-small-latest": [
    { kind: "rpm", limit: 5, windowMs: 60_000, strategy: "bucket" },
  ],
  "mistral:mistral-medium-latest": [
    { kind: "rpm", limit: 5, windowMs: 60_000, strategy: "bucket" },
  ],
};
