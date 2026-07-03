import { httpsCallable } from "firebase/functions";
import { getAppFunctions, isFirebaseConfigured } from "./firebase";
import { getDeviceId } from "./device";
import { MOCK_SIDEQUESTS } from "../data/mockSidequests";
import type {
  SidequestItem,
  CuratedSidequestRequest,
  SidequestResponse,
  DescribedSidequestRequest,
  DescribedSidequestResponse,
  SidequestTimings,
  UserProfile,
} from "../types";

/** Result of a generation call: the items plus optional server-side timings. */
export interface GenerateResult {
  items: SidequestItem[];
  /** Present only for live calls; the backend attaches it. Undefined in mock. */
  timings?: SidequestTimings;
}

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

/** Client-side mirror of the server's curated batch size (server-controlled). */
export const CURATED_BATCH_SIZE = 3;

/** Map a Firebase callable error to our ApiError codes. */
function mapCallableError(err: unknown, fallbackMsg: string): ApiError {
  if (err instanceof ApiError) return err;
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
  return new ApiError(code, e.message || fallbackMsg);
}

/**
 * Fetch the curated daily batch. Calls the deployed `generateCuratedSidequests`
 * callable (count is server-controlled), or returns local fixtures in mock mode.
 */
export async function generateCuratedSidequests(
  profile: UserProfile,
  excludeTitles: string[] = []
): Promise<GenerateResult> {
  if (isMockMode()) {
    await new Promise((r) => setTimeout(r, 1200));
    return { items: pickMock(CURATED_BATCH_SIZE, excludeTitles) };
  }

  const payload: CuratedSidequestRequest = {
    profile,
    excludeTitles,
    deviceId: getDeviceId(),
  };

  try {
    const fn = httpsCallable<CuratedSidequestRequest, SidequestResponse>(
      getAppFunctions(),
      "generateCuratedSidequests"
    );
    const res = await fn(payload);
    const sidequests = res.data?.sidequests;
    if (!sidequests || sidequests.length === 0) {
      throw new ApiError("generation_failed", "No sidequests were returned.");
    }
    return { items: sidequests, timings: res.data?.timings };
  } catch (err: unknown) {
    throw mapCallableError(err, "Something went wrong while curating your sidequests.");
  }
}

/**
 * Generate a single sidequest from a freeform user prompt via
 * `generateUserDescribedSidequest`. No backend rate limit during the testing
 * phase; blocked prompts (moderation) surface as `invalid_request`.
 */
export async function generateUserDescribedSidequest(
  prompt: string,
  profile: UserProfile
): Promise<SidequestItem> {
  if (isMockMode()) {
    await new Promise((r) => setTimeout(r, 1200));
    return pickMock(1, [])[0];
  }

  const payload: DescribedSidequestRequest = {
    prompt,
    profile,
    deviceId: getDeviceId(),
  };

  try {
    const fn = httpsCallable<DescribedSidequestRequest, DescribedSidequestResponse>(
      getAppFunctions(),
      "generateUserDescribedSidequest"
    );
    const res = await fn(payload);
    const sidequest = res.data?.sidequest;
    if (!sidequest) {
      throw new ApiError("generation_failed", "No sidequest was returned.");
    }
    return sidequest;
  } catch (err: unknown) {
    throw mapCallableError(err, "Something went wrong while crafting your sidequest.");
  }
}
