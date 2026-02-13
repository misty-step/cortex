import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  collectModels,
  clearModelCache,
  getModelCache,
} from "../../../src/server/collectors/models.js";
import * as fs from "node:fs";

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
    fs.mkdirSync("/tmp/test-openclaw", { recursive: true });
  });

  afterEach(() => {
    // Clean up test file
    try {
      fs.unlinkSync(testConfigPath);
      fs.rmdirSync("/tmp/test-openclaw");
    } catch {
      // Ignore cleanup errors
    }
  });

  it("should return fallback models when config file does not exist", () => {
    const models = collectModels();

    expect(models).toHaveLength(6);
    expect(models[0]!.id).toBe("moonshotai/kimi-k2.5");
    expect(models[0]!.provider).toBe("openrouter");
    expect(models[0]!.status).toBe("available");
  });

  it("should parse models from OpenClaw config file", () => {
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

    fs.writeFileSync(testConfigPath, JSON.stringify(config));

    const models = collectModels();

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

  it("should normalize model IDs by removing openrouter/ prefix", () => {
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

    fs.writeFileSync(testConfigPath, JSON.stringify(config));

    const models = collectModels();

    expect(models).toHaveLength(1);
    expect(models[0]!.id).toBe("anthropic/claude-sonnet-4");
  });

  it("should deduplicate models by ID", () => {
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

    fs.writeFileSync(testConfigPath, JSON.stringify(config));

    const models = collectModels();

    expect(models).toHaveLength(1);
    expect(models[0]!.id).toBe("moonshotai/kimi-k2.5");
  });

  it("should fallback when config has no models section", () => {
    const config = {
      logging: { level: "info" },
    };

    fs.writeFileSync(testConfigPath, JSON.stringify(config));

    const models = collectModels();

    // Should return fallback
    expect(models).toHaveLength(6);
    expect(models[0]!.id).toBe("moonshotai/kimi-k2.5");
  });

  it("should fallback when config has empty providers", () => {
    const config = {
      models: {
        providers: {},
      },
    };

    fs.writeFileSync(testConfigPath, JSON.stringify(config));

    const models = collectModels();

    expect(models).toHaveLength(6);
  });

  it("should fallback on invalid JSON", () => {
    fs.writeFileSync(testConfigPath, "not valid json");

    const models = collectModels();

    expect(models).toHaveLength(6);
  });

  it("should cache models for subsequent calls", () => {
    const config = {
      models: {
        providers: {
          openrouter: {
            models: [{ id: "test/model", name: "Test Model" }],
          },
        },
      },
    };

    fs.writeFileSync(testConfigPath, JSON.stringify(config));

    const firstCall = collectModels();
    const secondCall = collectModels();

    expect(firstCall).toBe(secondCall); // Same reference
    expect(getModelCache()).not.toBeNull();
  });

  it("should refresh cache after TTL expires", () => {
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

      fs.writeFileSync(testConfigPath, JSON.stringify(config));

      const firstCall = collectModels();

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
      fs.writeFileSync(testConfigPath, JSON.stringify(newConfig));

      const secondCall = collectModels();

      expect(secondCall).not.toBe(firstCall);
      expect(secondCall[0]!.id).toBe("test/model-v2");
    } finally {
      vi.useRealTimers();
    }
  });

  it("should handle models without names", () => {
    const config = {
      models: {
        providers: {
          openrouter: {
            models: [{ id: "provider/model-id" }],
          },
        },
      },
    };

    fs.writeFileSync(testConfigPath, JSON.stringify(config));

    const models = collectModels();

    expect(models[0]!.name).toBe("provider/model-id");
  });
});
