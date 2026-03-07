import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  calculateOpenRouterCostUsd,
  isOpenRouterModelId,
  _resetPricingCacheForTests,
} from "../services/openrouter-pricing.js";

const MOCK_API_RESPONSE = {
  data: [
    {
      id: "anthropic/claude-sonnet-4.6",
      pricing: { prompt: "0.000003", completion: "0.000015" },
    },
    {
      id: "anthropic/claude-opus-4.6",
      pricing: { prompt: "0.000015", completion: "0.000075" },
    },
    {
      id: "google/gemini-3",
      pricing: { prompt: "0.0000005", completion: "0.0000015" },
    },
    {
      id: "minimax/minimax-m2.5",
      // no pricing field — should be skipped
    },
  ],
};

function mockFetchOk() {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(MOCK_API_RESPONSE),
  });
}

function mockFetchFail(status = 500) {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    statusText: "Internal Server Error",
    json: () => Promise.resolve({}),
  });
}

describe("openrouter-pricing", () => {
  const originalEnv = process.env.OPENROUTER_API_KEY;

  beforeEach(() => {
    _resetPricingCacheForTests();
    process.env.OPENROUTER_API_KEY = "sk-or-test-key";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalEnv !== undefined) {
      process.env.OPENROUTER_API_KEY = originalEnv;
    } else {
      delete process.env.OPENROUTER_API_KEY;
    }
  });

  describe("isOpenRouterModelId", () => {
    it("returns true for openrouter/ prefixed model IDs", () => {
      expect(isOpenRouterModelId("openrouter/anthropic/claude-sonnet-4.6")).toBe(true);
      expect(isOpenRouterModelId("openrouter/google/gemini-3")).toBe(true);
    });

    it("returns false for non-openrouter model IDs", () => {
      expect(isOpenRouterModelId("anthropic/claude-sonnet-4.6")).toBe(false);
      expect(isOpenRouterModelId("openai/gpt-5")).toBe(false);
      expect(isOpenRouterModelId("")).toBe(false);
    });
  });

  describe("calculateOpenRouterCostUsd", () => {
    it("calculates cost from token counts and OpenRouter pricing", async () => {
      vi.stubGlobal("fetch", mockFetchOk());

      const cost = await calculateOpenRouterCostUsd(
        "openrouter/anthropic/claude-sonnet-4.6",
        1000, // input tokens
        500,  // output tokens
      );

      expect(cost).not.toBeNull();
      // 1000 * 0.000003 + 500 * 0.000015 = 0.003 + 0.0075 = 0.0105
      expect(cost).toBeCloseTo(0.0105, 6);
    });

    it("strips openrouter/ prefix to look up catalog ID", async () => {
      vi.stubGlobal("fetch", mockFetchOk());

      const cost = await calculateOpenRouterCostUsd(
        "openrouter/anthropic/claude-opus-4.6",
        2000,
        1000,
      );

      // 2000 * 0.000015 + 1000 * 0.000075 = 0.03 + 0.075 = 0.105
      expect(cost).toBeCloseTo(0.105, 6);
    });

    it("returns null when model is not in OpenRouter catalog", async () => {
      vi.stubGlobal("fetch", mockFetchOk());

      const cost = await calculateOpenRouterCostUsd(
        "openrouter/unknown/model-xyz",
        1000,
        500,
      );

      expect(cost).toBeNull();
    });

    it("returns null when model has no pricing data", async () => {
      vi.stubGlobal("fetch", mockFetchOk());

      // minimax/minimax-m2.5 has no pricing in mock data
      const cost = await calculateOpenRouterCostUsd(
        "openrouter/minimax/minimax-m2.5",
        1000,
        500,
      );

      expect(cost).toBeNull();
    });

    it("returns null when API key is not set", async () => {
      delete process.env.OPENROUTER_API_KEY;
      vi.stubGlobal("fetch", mockFetchOk());

      const cost = await calculateOpenRouterCostUsd(
        "openrouter/anthropic/claude-sonnet-4.6",
        1000,
        500,
      );

      expect(cost).toBeNull();
    });

    it("returns null when API returns non-OK status", async () => {
      vi.stubGlobal("fetch", mockFetchFail(401));

      const cost = await calculateOpenRouterCostUsd(
        "openrouter/anthropic/claude-sonnet-4.6",
        1000,
        500,
      );

      expect(cost).toBeNull();
    });

    it("returns null when fetch throws (network error)", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

      const cost = await calculateOpenRouterCostUsd(
        "openrouter/anthropic/claude-sonnet-4.6",
        1000,
        500,
      );

      expect(cost).toBeNull();
    });

    it("caches pricing and reuses on subsequent calls", async () => {
      const mockFetch = mockFetchOk();
      vi.stubGlobal("fetch", mockFetch);

      await calculateOpenRouterCostUsd("openrouter/anthropic/claude-sonnet-4.6", 100, 50);
      await calculateOpenRouterCostUsd("openrouter/anthropic/claude-opus-4.6", 200, 100);

      // fetch should only be called once — second call uses cache
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("returns zero cost when token counts are zero", async () => {
      vi.stubGlobal("fetch", mockFetchOk());

      const cost = await calculateOpenRouterCostUsd(
        "openrouter/anthropic/claude-sonnet-4.6",
        0,
        0,
      );

      expect(cost).toBe(0);
    });

    it("handles malformed pricing strings gracefully", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          data: [{
            id: "bad/model",
            pricing: { prompt: "not-a-number", completion: "" },
          }],
        }),
      }));

      const cost = await calculateOpenRouterCostUsd("openrouter/bad/model", 1000, 500);

      // parseTokenPrice returns 0 for invalid strings, so cost = 0
      expect(cost).toBe(0);
    });
  });
});
