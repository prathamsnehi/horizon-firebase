/**
 * Provider-agnostic LLM layer types.
 */

export type ProviderId = "gemini" | "groq" | "mistral" | "cerebras";

export type ModelClassName = "scout" | "writer" | "generic";

/**
 * One concrete (provider, model) option the router can try for a stage.
 */
export interface ModelCandidate {
  providerId: ProviderId;
  modelId: string;
  /**
   * Opaque provider-specific options forwarded to `generateObject`
   * (e.g. Gemini thinking config). Shape is defined by the AI SDK provider.
   */
  providerOptions?: Record<string, unknown>;
}

/** One provider attempt within a routed generation (for the failover trace). */
export interface RoutingAttempt {
  provider: ProviderId;
  model: string;
  ok: boolean;
  latencyMs: number;
  error?: string;
}

/**
 * The outcome of a routed generation: the parsed object plus which provider/model
 * actually served it and how it went (for logging + telemetry).
 */
export interface RoutingResult<T> {
  object: T;
  providerUsed: ProviderId;
  modelUsed: string;
  attempts: number;
  latencyMs: number;
  /** Ordered per-provider attempt chain (successes + failures). */
  attemptLog: RoutingAttempt[];
}
