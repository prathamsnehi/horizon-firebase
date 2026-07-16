import { onTaskDispatched } from "firebase-functions/v2/tasks";
import { PregenTaskPayload } from "../types";
import { generateBatch } from "../services/questService";
import { hashProfile } from "../utils/hash";
import { flushLogs, savePregeneratedBatch } from "../integrations/firestore";
import { runTrace, setTraceField } from "../observability/tracer";
import {
  geminiApiKey,
  placesApiKey,
  groqApiKey,
  mistralApiKey,
  cerebrasApiKey,
  CURATED_BATCH_SIZE,
} from "../config";

/**
 * Background pre-generation of the next curated batch. Enqueued by
 * `generateCuratedQuests` after it serves; runs off the request path so the
 * next day's batch is ready instantly. Best-effort: a failure just means the
 * next request falls back to synchronous generation.
 */
export const pregenerateCuratedBatch = onTaskDispatched(
  {
    secrets: [
      geminiApiKey,
      placesApiKey,
      groqApiKey,
      mistralApiKey,
      cerebrasApiKey,
    ],
    retryConfig: { maxAttempts: 2 },
    rateLimits: { maxConcurrentDispatches: 5 }, // workers allowed to run in parallel, doesn't limit the queue
    timeoutSeconds: 120, // same two-pass generation as the callables
  },
  async (request) => {
    const { deviceId, profile } = request.data as PregenTaskPayload;
    if (!deviceId || !profile) {
      console.error("[pregenerateCuratedBatch] Invalid payload; skipping.");
      return;
    }

    await runTrace({ type: "pregen", deviceId }, async () => {
      try {
        const quests = await generateBatch(profile, CURATED_BATCH_SIZE, []);
        await savePregeneratedBatch(deviceId, quests, hashProfile(profile));
        await flushLogs();
        setTraceField({ result: { quests } });
        console.log(
          `[pregenerateCuratedBatch] Stored next batch for ${deviceId}.`,
        );
      } catch (err) {
        // Swallow (best-effort pre-gen); the trace still records outcome:"error".
        setTraceField({ outcome: "error", error: String((err as Error)?.message ?? err) });
        console.error("[pregenerateCuratedBatch] Failed:", err);
      }
    });
  },
);
