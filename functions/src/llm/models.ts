import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { createMistral } from "@ai-sdk/mistral";
import { createCerebras } from "@ai-sdk/cerebras";
import type { LanguageModel } from "ai";
import {
  geminiApiKey,
  groqApiKey,
  mistralApiKey,
  cerebrasApiKey,
} from "../config";
import { ModelCandidate, ModelClassName } from "./types";

/**
 * Lazy provider factories. Secret values are only readable while a function is
 * actively executing, so we build each provider on first use and cache it for
 * warm invocations (mirrors the old getAIClient pattern).
 */
type ProviderFactory = ReturnType<typeof createGoogleGenerativeAI>;

let _google: ProviderFactory | null = null;
let _groq: ReturnType<typeof createGroq> | null = null;
let _mistral: ReturnType<typeof createMistral> | null = null;
let _cerebras: ReturnType<typeof createCerebras> | null = null;

function google() {
  if (!_google) _google = createGoogleGenerativeAI({ apiKey: geminiApiKey.value() });
  return _google;
}
function groq() {
  if (!_groq) _groq = createGroq({ apiKey: groqApiKey.value() });
  return _groq;
}
function mistral() {
  if (!_mistral) _mistral = createMistral({ apiKey: mistralApiKey.value() });
  return _mistral;
}
function cerebras() {
  if (!_cerebras) _cerebras = createCerebras({ apiKey: cerebrasApiKey.value() });
  return _cerebras;
}

/**
 * The rate-limit key for a candidate. Limits are metered per model, so the key
 * is `${providerId}:${modelId}` (see rateLimits.ts).
 */
export function rateKeyFor(candidate: ModelCandidate): string {
  return `${candidate.providerId}:${candidate.modelId}`;
}

/**
 * Resolve a candidate to a concrete AI SDK model instance.
 */
export function resolveModel(candidate: ModelCandidate): LanguageModel {
  switch (candidate.providerId) {
    case "gemini":
      return google()(candidate.modelId);
    case "groq":
      return groq()(candidate.modelId);
    case "mistral":
      return mistral()(candidate.modelId);
    case "cerebras":
      return cerebras()(candidate.modelId);
  }
}

/**
 * Per-stage candidate lists (priority order). Gemini stays primary to preserve
 * current behavior; the others provide distribution + failover. Model IDs churn
 * across free tiers — confirm/tune them against each provider's current catalog.
 */
export const MODEL_CLASSES: Record<ModelClassName, ModelCandidate[]> = {
  // Fast/cheap query generation. Gemini scout keeps MINIMAL thinking via providerOptions.
  scout: [
    {
      providerId: "gemini",
      modelId: "gemini-3.1-flash-lite",
      providerOptions: { google: { thinkingConfig: { thinkingBudget: 0 } } },
    },
    { providerId: "groq", modelId: "llama-3.1-8b-instant" },
    { providerId: "mistral", modelId: "mistral-small-latest" },
    { providerId: "cerebras", modelId: "gpt-oss-120b" },
  ],
  // Quality writing of the final sidequests.
  writer: [
    { providerId: "gemini", modelId: "gemini-3.5-flash" },
    { providerId: "groq", modelId: "llama-3.3-70b-versatile" },
    { providerId: "mistral", modelId: "mistral-medium-latest" },
    { providerId: "cerebras", modelId: "gpt-oss-120b" },
  ],
  // Location-agnostic fallback quests (same quality tier as the writer).
  generic: [
    { providerId: "gemini", modelId: "gemini-3.5-flash" },
    { providerId: "groq", modelId: "llama-3.3-70b-versatile" },
    { providerId: "mistral", modelId: "mistral-medium-latest" },
    { providerId: "cerebras", modelId: "gpt-oss-120b" },
  ],
};
