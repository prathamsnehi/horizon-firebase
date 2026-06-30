import { httpsCallable } from "firebase/functions";
import { getAppFunctions, isFirebaseConfigured } from "./firebase";
import { getDeviceId } from "./device";
import { MOCK_SIDEQUESTS } from "../data/mockSidequests";
import type {
  SidequestItem,
  SidequestRequest,
  SidequestResponse,
  UserProfile,
} from "../types";

const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";

export class ApiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "ApiError";
  }
}

/** Whether requests will be served from local fixtures instead of the backend. */
export function isMockMode(): boolean {
  return USE_MOCK || !isFirebaseConfigured();
}

function pickMock(count: number, excludeTitles: string[]): SidequestItem[] {
  const exclude = new Set(excludeTitles);
  const pool = MOCK_SIDEQUESTS.filter((q) => !exclude.has(q.title));
  const chosen: SidequestItem[] = [];
  let i = 0;
  while (chosen.length < count) {
    const base = pool[i % pool.length] ?? MOCK_SIDEQUESTS[i % MOCK_SIDEQUESTS.length];
    // Make titles unique across repeats so excludeTitles stays meaningful.
    const suffix = Math.floor(i / pool.length);
    chosen.push(
      suffix > 0 ? { ...base, title: `${base.title} #${suffix + 1}` } : base
    );
    i++;
    if (i > count * 4) break;
  }
  return chosen.slice(0, count);
}

/**
 * Generate a batch of sidequests. Calls the deployed `generateSidequests`
 * callable, or returns local fixtures when in mock mode.
 */
export async function generateSidequests(
  profile: UserProfile,
  count: number,
  excludeTitles: string[]
): Promise<SidequestItem[]> {
  if (isMockMode()) {
    // Simulate network latency so the "curating" state is exercised.
    await new Promise((r) => setTimeout(r, 1200));
    return pickMock(count, excludeTitles);
  }

  const payload: SidequestRequest = {
    profile,
    count,
    excludeTitles,
    deviceId: getDeviceId(),
  };

  try {
    const fn = httpsCallable<SidequestRequest, SidequestResponse>(
      getAppFunctions(),
      "generateSidequests"
    );
    const res = await fn(payload);
    const sidequests = res.data?.sidequests;
    if (!sidequests || sidequests.length === 0) {
      throw new ApiError("generation_failed", "No sidequests were returned.");
    }
    return sidequests;
  } catch (err: unknown) {
    if (err instanceof ApiError) throw err;
    const e = err as { code?: string; message?: string };
    // Firebase callable errors look like "functions/<code>".
    const raw = (e.code ?? "").replace("functions/", "");
    const code =
      raw === "resource-exhausted"
        ? "rate_limited"
        : raw === "unavailable"
        ? "service_unavailable"
        : raw === "invalid-argument"
        ? "invalid_request"
        : "generation_failed";
    throw new ApiError(
      code,
      e.message || "Something went wrong while curating your sidequests."
    );
  }
}
