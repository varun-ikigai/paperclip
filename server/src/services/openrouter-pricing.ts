/**
 * OpenRouter Pricing Service
 *
 * Fetches and caches model pricing from OpenRouter's /api/v1/models endpoint.
 * Used to calculate costs server-side from token counts rather than trusting
 * adapter-reported costs.
 */

import { logger } from "../middleware/logger.js";

export interface OpenRouterModelPricing {
  /** Cost per input token in USD (string from API, e.g. "0.00003") */
  promptUsdPerToken: number;
  /** Cost per output token in USD */
  completionUsdPerToken: number;
}

interface OpenRouterModelEntry {
  id: string;
  pricing?: {
    prompt?: string;
    completion?: string;
  };
}

interface PricingCache {
  /** model ID (OpenRouter format, e.g. "anthropic/claude-opus-4.6") → pricing */
  models: Map<string, OpenRouterModelPricing>;
  fetchedAt: number;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const FETCH_TIMEOUT_MS = 10_000;

let cache: PricingCache | null = null;
let fetchInFlight: Promise<PricingCache | null> | null = null;

function parseTokenPrice(value: string | undefined): number {
  if (!value) return 0;
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

async function fetchPricingFromOpenRouter(apiKey: string): Promise<PricingCache | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch("https://openrouter.ai/api/v1/models", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      logger.warn(
        { status: response.status, statusText: response.statusText },
        "OpenRouter pricing API returned non-OK status",
      );
      return null;
    }

    const body = (await response.json()) as { data?: OpenRouterModelEntry[] };
    if (!body.data || !Array.isArray(body.data)) {
      logger.warn("OpenRouter pricing API returned unexpected body shape");
      return null;
    }

    const models = new Map<string, OpenRouterModelPricing>();
    for (const entry of body.data) {
      if (!entry.id || !entry.pricing) continue;
      models.set(entry.id, {
        promptUsdPerToken: parseTokenPrice(entry.pricing.prompt),
        completionUsdPerToken: parseTokenPrice(entry.pricing.completion),
      });
    }

    logger.info({ modelCount: models.size }, "OpenRouter pricing cache refreshed");
    return { models, fetchedAt: Date.now() };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn({ error: message }, "Failed to fetch OpenRouter pricing");
    return null;
  }
}

function resolveApiKey(): string | null {
  return process.env.OPENROUTER_API_KEY?.trim() || null;
}

async function ensureCache(): Promise<PricingCache | null> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache;
  }

  const apiKey = resolveApiKey();
  if (!apiKey) {
    return cache; // return stale cache if available, null otherwise
  }

  // Deduplicate concurrent fetches
  if (!fetchInFlight) {
    fetchInFlight = fetchPricingFromOpenRouter(apiKey).then((result) => {
      fetchInFlight = null;
      if (result) cache = result;
      return cache;
    });
  }

  return fetchInFlight;
}

/**
 * Strip the `openrouter/` prefix from a Paperclip model ID to get the
 * OpenRouter catalog ID.
 *
 * Example: "openrouter/anthropic/claude-sonnet-4.6" → "anthropic/claude-sonnet-4.6"
 */
function toOpenRouterCatalogId(modelId: string): string {
  return modelId.startsWith("openrouter/") ? modelId.slice("openrouter/".length) : modelId;
}

/**
 * Calculate cost in USD from token counts using OpenRouter pricing.
 *
 * Returns null if pricing is unavailable (no API key, model not found, fetch failed).
 * The caller should fall back to adapter-reported cost in that case.
 */
export async function calculateOpenRouterCostUsd(
  modelId: string,
  inputTokens: number,
  outputTokens: number,
): Promise<number | null> {
  const pricing = await ensureCache();
  if (!pricing) return null;

  const catalogId = toOpenRouterCatalogId(modelId);
  const modelPricing = pricing.models.get(catalogId);
  if (!modelPricing) {
    logger.debug({ modelId, catalogId }, "No OpenRouter pricing found for model");
    return null;
  }

  const cost =
    inputTokens * modelPricing.promptUsdPerToken +
    outputTokens * modelPricing.completionUsdPerToken;

  return cost;
}

/**
 * Check if a model ID is an OpenRouter model (has the openrouter/ prefix).
 */
export function isOpenRouterModelId(modelId: string): boolean {
  return modelId.startsWith("openrouter/");
}

/** Reset cache — for tests only. */
export function _resetPricingCacheForTests(): void {
  cache = null;
  fetchInFlight = null;
}
