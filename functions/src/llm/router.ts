import { generateObject } from "ai";
import { z } from "zod";
import { ModelClassName, RoutingResult } from "./types";
import { MODEL_CLASSES, resolveModel, rateKeyFor } from "./models";
import { MODEL_RATE_LIMITS } from "./rateLimits";
import {
  reserveLlmToken,
  penalizeRateKey,
} from "../integrations/firestore";

/**
 * Classify an error as "try the next provider" — rate limits, transient server
 * errors, timeouts, or a schema-validation failure from generateObject.
 */
function isRetryable(err: any): boolean {
  const status = err?.statusCode ?? err?.status ?? err?.response?.status;
  if (status === 429) return true;
  if (typeof status === "number" && status >= 500 && status < 600) return true;
  const name = String(err?.name ?? "");
  return (
    name === "AI_APICallError" ||
    name === "AI_RetryError" ||
    name === "AI_NoObjectGeneratedError" ||
    name === "AI_TypeValidationError" ||
    name.includes("Timeout")
  );
}

export interface RoutingOptions<T> {
  schema: z.ZodType<T>;
  prompt: string;
  temperature?: number;
}

/**
 * Generate structured output for a stage, distributing load across providers
 * (rate-aware, global via Firestore) and failing over on error.
 */
export async function generateObjectWithRouting<T>(
  className: ModelClassName,
  opts: RoutingOptions<T>
): Promise<RoutingResult<T>> {
  const candidates = MODEL_CLASSES[className];
  const candidateKeys = candidates.map(rateKeyFor);

  // Global, rate-aware ordering (per model). Fails open to static priority order.
  const order = await reserveLlmToken(candidateKeys, MODEL_RATE_LIMITS);
  const ordered = [...candidates].sort(
    (a, b) => order.indexOf(rateKeyFor(a)) - order.indexOf(rateKeyFor(b))
  );

  let attempts = 0;
  const errors: string[] = [];

  for (const candidate of ordered) {
    attempts++;
    const start = Date.now();
    try {
      const { object } = await generateObject({
        model: resolveModel(candidate),
        schema: opts.schema,
        prompt: opts.prompt,
        ...(opts.temperature != null ? { temperature: opts.temperature } : {}),
        ...(candidate.providerOptions
          ? { providerOptions: candidate.providerOptions as any }
          : {}),
      });
      return {
        object: object as T,
        providerUsed: candidate.providerId,
        modelUsed: candidate.modelId,
        attempts,
        latencyMs: Date.now() - start,
      };
    } catch (err: any) {
      const msg = `${candidate.providerId}/${candidate.modelId}: ${err?.message ?? err}`;
      console.error(`[llm.router] ${className} attempt failed — ${msg}`);
      errors.push(msg);
      if (isRetryable(err)) {
        // Drain this model's buckets so subsequent calls route elsewhere.
        void penalizeRateKey(rateKeyFor(candidate));
      }
    }
  }

  throw new Error(
    `[llm.router] All ${className} providers failed: ${errors.join(" | ")}`
  );
}
