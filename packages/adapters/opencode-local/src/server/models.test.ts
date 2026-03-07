import { afterEach, describe, expect, it } from "vitest";
import {
  ensureOpenCodeModelConfiguredAndAvailable,
  listOpenCodeModels,
  resetOpenCodeModelsCacheForTests,
} from "./models.js";
import { isOpenRouterModel } from "./execute.js";

describe("openCode models", () => {
  afterEach(() => {
    delete process.env.PAPERCLIP_OPENCODE_COMMAND;
    resetOpenCodeModelsCacheForTests();
  });

  it("returns static models when discovery command is unavailable", async () => {
    process.env.PAPERCLIP_OPENCODE_COMMAND = "__paperclip_missing_opencode_command__";
    const result = await listOpenCodeModels();
    // Should return at least the static ZDR models
    expect(result.length).toBeGreaterThanOrEqual(6);
    expect(result.some((m) => m.id === "openrouter/anthropic/claude-opus-4.6")).toBe(true);
  });

  it("rejects when model is missing", async () => {
    await expect(
      ensureOpenCodeModelConfiguredAndAvailable({ model: "" }),
    ).rejects.toThrow("OpenCode requires `adapterConfig.model`");
  });

  it("rejects when discovery cannot run for configured model", async () => {
    process.env.PAPERCLIP_OPENCODE_COMMAND = "__paperclip_missing_opencode_command__";
    await expect(
      ensureOpenCodeModelConfiguredAndAvailable({
        model: "openai/gpt-5",
      }),
    ).rejects.toThrow("Failed to start command");
  });

  it("identifies static ZDR models as OpenRouter models", () => {
    expect(isOpenRouterModel("openrouter/anthropic/claude-opus-4.6")).toBe(true);
    expect(isOpenRouterModel("openrouter/anthropic/claude-sonnet-4.6")).toBe(true);
    expect(isOpenRouterModel("openrouter/anthropic/claude-haiku-4.6")).toBe(true);
    expect(isOpenRouterModel("openrouter/minimax/minimax-m2.5")).toBe(true);
    expect(isOpenRouterModel("openrouter/zhipu/glm-5")).toBe(true);
    expect(isOpenRouterModel("openrouter/google/gemini-3")).toBe(true);
  });

  it("does not identify non-ZDR models as OpenRouter models", () => {
    expect(isOpenRouterModel("openai/gpt-5")).toBe(false);
    expect(isOpenRouterModel("anthropic/claude-3-opus")).toBe(false);
    expect(isOpenRouterModel("")).toBe(false);
  });

  it("accepts static ZDR model without CLI discovery", async () => {
    process.env.PAPERCLIP_OPENCODE_COMMAND = "__paperclip_missing_opencode_command__";
    const result = await ensureOpenCodeModelConfiguredAndAvailable({
      model: "openrouter/anthropic/claude-opus-4.6",
    });
    expect(result.some((m) => m.id === "openrouter/anthropic/claude-opus-4.6")).toBe(true);
  });

  it("includes all 6 ZDR models in listing when CLI is unavailable", async () => {
    process.env.PAPERCLIP_OPENCODE_COMMAND = "__paperclip_missing_opencode_command__";
    const result = await listOpenCodeModels();
    const ids = result.map((m) => m.id);
    expect(ids).toContain("openrouter/anthropic/claude-opus-4.6");
    expect(ids).toContain("openrouter/anthropic/claude-sonnet-4.6");
    expect(ids).toContain("openrouter/anthropic/claude-haiku-4.6");
    expect(ids).toContain("openrouter/minimax/minimax-m2.5");
    expect(ids).toContain("openrouter/zhipu/glm-5");
    expect(ids).toContain("openrouter/google/gemini-3");
  });
});
