import { onTaskDispatched } from "firebase-functions/v2/tasks";
import { PregenTaskPayload } from "../types";
import { generateBatch } from "../services/questService";
import { hashProfile } from "../utils/hash";
import {
  flushLogs,
  savePregeneratedBatch,
} from "../integrations/firestore";
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
    secrets: [geminiApiKey, placesApiKey, groqApiKey, mistralApiKey, cerebrasApiKey],
    retryConfig: { maxAttempts: 2 },
    rateLimits: { maxConcurrentDispatches: 5 },
  },
  async (request) => {
    const { deviceId, profile } = request.data as PregenTaskPayload;
    if (!deviceId || !profile) {
      console.error("[pregenerateCuratedBatch] Invalid payload; skipping.");
      return;
    }

    try {
      const quests = await generateBatch(profile, CURATED_BATCH_SIZE, []);
      await savePregeneratedBatch(deviceId, quests, hashProfile(profile));
      await flushLogs();
      console.log(`[pregenerateCuratedBatch] Stored next batch for ${deviceId}.`);
    } catch (err) {
      console.error("[pregenerateCuratedBatch] Failed:", err);
    }
  }
);
