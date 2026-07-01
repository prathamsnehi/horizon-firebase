import { z } from "zod";

// Mock the AI SDK so no network calls happen.
jest.mock("ai", () => ({ generateObject: jest.fn() }));

// Mock the model registry so we don't touch provider SDKs / secrets, and so we
// control the candidate list for the "writer" class.
jest.mock("../../llm/models", () => ({
  MODEL_CLASSES: {
    writer: [
      { providerId: "gemini", modelId: "g-model" },
      { providerId: "groq", modelId: "q-model" },
    ],
  },
  resolveModel: () => ({}),
  rateKeyFor: (c: { providerId: string; modelId: string }) =>
    `${c.providerId}:${c.modelId}`,
}));

// Mock the Firestore rate limiter: reserve returns the order unchanged (fail-open
// behavior is exercised implicitly), penalize is a no-op we can assert on.
jest.mock("../../integrations/firestore", () => ({
  reserveLlmToken: jest.fn(async (keys: string[]) => keys),
  penalizeRateKey: jest.fn(async () => {}),
}));

import { generateObject } from "ai";
import { generateObjectWithRouting } from "../../llm/router";
import { penalizeRateKey } from "../../integrations/firestore";

const schema = z.object({ ok: z.boolean() });
const genObj = generateObject as jest.Mock;

function rateError(status: number) {
  return Object.assign(new Error(`http ${status}`), { statusCode: status });
}

describe("generateObjectWithRouting", () => {
  beforeEach(() => {
    genObj.mockReset();
    (penalizeRateKey as jest.Mock).mockClear();
  });

  it("returns the first provider on success", async () => {
    genObj.mockResolvedValueOnce({ object: { ok: true } });

    const result = await generateObjectWithRouting("writer", {
      schema,
      prompt: "p",
    });

    expect(result.providerUsed).toBe("gemini");
    expect(result.modelUsed).toBe("g-model");
    expect(result.attempts).toBe(1);
    expect(genObj).toHaveBeenCalledTimes(1);
  });

  it("fails over to the next provider on a 429 and penalizes the first", async () => {
    genObj
      .mockRejectedValueOnce(rateError(429))
      .mockResolvedValueOnce({ object: { ok: true } });

    const result = await generateObjectWithRouting("writer", {
      schema,
      prompt: "p",
    });

    expect(result.providerUsed).toBe("groq");
    expect(result.attempts).toBe(2);
    expect(penalizeRateKey).toHaveBeenCalledWith("gemini:g-model");
  });

  it("throws an aggregate error only when every provider fails", async () => {
    genObj.mockRejectedValue(rateError(500));

    await expect(
      generateObjectWithRouting("writer", { schema, prompt: "p" })
    ).rejects.toThrow(/All writer providers failed/);
    expect(genObj).toHaveBeenCalledTimes(2);
  });
});
