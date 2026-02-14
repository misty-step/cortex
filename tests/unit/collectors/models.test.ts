import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  collectModels,
  clearModelCache,
  getModelCache,
} from "../../../src/server/collectors/models.js";
import * as fsSync from "node:fs";

vi.mock("../../../src/server/config.js", () => ({
  config: {
    openclawHome: "/tmp/test-openclaw",
  },
}));

describe("collectModels", () => {
  const testConfigPath = "/tmp/test-openclaw/openclaw.json";

  beforeEach(() => {
    clearModelCache();
    // Ensure test directory exists
    fsSync.mkdirSync("/tmp/test-openclaw", { recursive: true });
  });

  afterEach(() => {
    // Clean up test file
    try {
      fsSync.unlinkSync(testConfigPath);
      fsSync.rmdirSync("/tmp/test-openclaw");
    } catch {
      // Ignore cleanup errors
    }
  });

  it("should return fallback models when config file does not exist", async () => {
    const models = await collectModels();

    expect(models).toHaveLength(6);
    expect(models[0]!.id).toBe("moonshotai/kimi-k2.5");
    expect(models[0]!.provider).toBe("openrouter");
    expect(models[0]!.status).toBe("available");
  });

  it("should parse models from OpenClaw config file", async () => {
    const config = {
      models: {
        providers: {
          openrouter: {
            models: [
              {
                id: "openrouter/moonshotai/kimi-k2.5",
                name: "Kimi K2.5",
                contextWindow: 262144,
              },
              {
                id: "openrouter/minimax/minimax-m2.5",
                name: "Minimax M2.5",
                contextWindow: 1048576,
              },
            ],
          },
          anthropic: {
            models: [
              {
                id: "anthropic/claude-opus-4",
                name: "Claude Opus 4",
                contextWindow: 200000,
              },
            ],
          },
        },
      },
    };

    fsSync.writeFileSync(testConfigPath, JSON.stringify(config));

    const models = await collectModels();

    expect(models).toHaveLength(3);
    expect(models).toContainEqual({
      id: "moonshotai/kimi-k2.5",
      name: "Kimi K2.5",
      provider: "openrouter",
      status: "available",
    });
    expect(models).toContainEqual({
      id: "minimax/minimax-m2.5",
      name: "Minimax M2.5",
      provider: "openrouter",
      status: "available",
    });
    expect(models).toContainEqual({
      id: "anthropic/claude-opus-4",
      name: "Claude Opus 4",
      provider: "anthropic",
      status: "available",
    });
  });

  it("should normalize model IDs by removing openrouter/ prefix", async () => {
    const config = {
      models: {
        providers: {
          openrouter: {
            models: [
              {
                id: "openrouter/anthropic/claude-sonnet-4",
                name: "Claude Sonnet 4",
              },
            ],
          },
        },
      },
    };

    fsSync.writeFileSync(testConfigPath, JSON.stringify(config));

    const models = await collectModels();

    expect(models).toHaveLength(1);
    expect(models[0]!.id).toBe("anthropic/claude-sonnet-4");
  });

  it("should deduplicate models by ID", async () => {
    const config = {
      models: {
        providers: {
          openrouter: {
            models: [
              { id: "openrouter/moonshotai/kimi-k2.5", name: "Kimi K2.5" },
              { id: "moonshotai/kimi-k2.5", name: "Kimi K2.5 Alias" },
            ],
          },
        },
      },
    };

    fsSync.writeFileSync(testConfigPath, JSON.stringify(config));

    const models = await collectModels();

    expect(models).toHaveLength(1);
    expect(models[0]!.id).toBe("moonshotai/kimi-k2.5");
  });

  it("should fallback when config has no models section", async () => {
    const config = {
      logging: { level: "info" },
    };

    fsSync.writeFileSync(testConfigPath, JSON.stringify(config));

    const models = await collectModels();

    // Should return fallback
    expect(models).toHaveLength(6);
    expect(models[0]!.id).toBe("moonshotai/kimi-k2.5");
  });

  it("should fallback when config has empty providers", async () => {
    const config = {
      models: {
        providers: {},
      },
    };

    fsSync.writeFileSync(testConfigPath, JSON.stringify(config));

    const models = await collectModels();

    expect(models).toHaveLength(6);
  });

  it("should fallback on invalid JSON", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    fsSync.writeFileSync(testConfigPath, "not valid json");

    const models = await collectModels();

    expect(models).toHaveLength(6);
    vi.restoreAllMocks();
  });

  it("should cache models for subsequent calls", async () => {
    const config = {
      models: {
        providers: {
          openrouter: {
            models: [{ id: "test/model", name: "Test Model" }],
          },
        },
      },
    };

    fsSync.writeFileSync(testConfigPath, JSON.stringify(config));

    const firstCall = await collectModels();
    const secondCall = await collectModels();

    expect(firstCall).toBe(secondCall); // Same reference
    expect(getModelCache()).not.toBeNull();
  });

  it("should refresh cache after TTL expires", async () => {
    vi.useFakeTimers();

    try {
      const config = {
        models: {
          providers: {
            openrouter: {
              models: [{ id: "test/model", name: "Test Model" }],
            },
          },
        },
      };

      fsSync.writeFileSync(testConfigPath, JSON.stringify(config));

      const firstCall = await collectModels();

      // Advance past the 60s TTL
      vi.advanceTimersByTime(60_001);

      // Update config
      const newConfig = {
        models: {
          providers: {
            openrouter: {
              models: [{ id: "test/model-v2", name: "Test Model V2" }],
            },
          },
        },
      };
      fsSync.writeFileSync(testConfigPath, JSON.stringify(newConfig));

      const secondCall = await collectModels();

      expect(secondCall).not.toBe(firstCall);
      expect(secondCall[0]!.id).toBe("test/model-v2");
    } finally {
      vi.useRealTimers();
    }
  });

  it("should use same TTL for fallback models", async () => {
    vi.useFakeTimers();

    try {
      // No config file — will use fallback
      const firstCall = await collectModels();
      expect(firstCall).toHaveLength(6);
      expect(getModelCache()!.isFallback).toBe(true);

      // Advance past the 60s TTL
      vi.advanceTimersByTime(60_001);

      // Now write a real config
      const config = {
        models: {
          providers: {
            openrouter: {
              models: [{ id: "test/model", name: "Test Model" }],
            },
          },
        },
      };
      fsSync.writeFileSync(testConfigPath, JSON.stringify(config));

      const secondCall = await collectModels();
      expect(secondCall).toHaveLength(1);
      expect(secondCall[0]!.id).toBe("test/model");
      expect(getModelCache()!.isFallback).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("should skip models with missing or non-string id", async () => {
    const config = {
      models: {
        providers: {
          openrouter: {
            models: [
              { id: "valid/model", name: "Valid" },
              { name: "No ID" },
              { id: 123, name: "Numeric ID" },
              { id: null, name: "Null ID" },
              null,
              undefined,
            ],
          },
        },
      },
    };

    fsSync.writeFileSync(testConfigPath, JSON.stringify(config));

    const models = await collectModels();

    expect(models).toHaveLength(1);
    expect(models[0]!.id).toBe("valid/model");
  });

  it("should warn when config file has invalid JSON", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    fsSync.writeFileSync(testConfigPath, "not valid json");

    await collectModels();

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Failed to parse openclaw config"),
      expect.any(String),
    );

    warnSpy.mockRestore();
  });

  it("should handle models without names", async () => {
    const config = {
      models: {
        providers: {
          openrouter: {
            models: [{ id: "provider/model-id" }],
          },
        },
      },
    };

    fsSync.writeFileSync(testConfigPath, JSON.stringify(config));

    const models = await collectModels();

    expect(models[0]!.name).toBe("provider/model-id");
  });
});
