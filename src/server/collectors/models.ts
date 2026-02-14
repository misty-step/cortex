import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { ModelInfo } from "../../shared/types.js";
import { config } from "../config.js";

// Cache for models with TTL
interface CachedModels {
  models: ModelInfo[];
  timestamp: number;
  isFallback: boolean;
}

let modelCache: CachedModels | null = null;
const CACHE_TTL_MS = 60_000; // 1 minute
const FALLBACK_CACHE_TTL_MS = 10_000; // 10 seconds — retry sooner when using fallback

// Fallback static list when gateway config is unavailable
const FALLBACK_MODELS: ModelInfo[] = [
  { id: "moonshotai/kimi-k2.5", name: "Kimi K2.5", provider: "openrouter", status: "available" },
  {
    id: "anthropic/claude-sonnet-4",
    name: "Claude Sonnet 4",
    provider: "openrouter",
    status: "available",
  },
  {
    id: "anthropic/claude-opus-4",
    name: "Claude Opus 4",
    provider: "openrouter",
    status: "available",
  },
  { id: "openai/gpt-4o", name: "GPT-4o", provider: "openrouter", status: "available" },
  {
    id: "google/gemini-flash-1.5",
    name: "Gemini Flash 1.5",
    provider: "openrouter",
    status: "available",
  },
  {
    id: "mistralai/mistral-large",
    name: "Mistral Large",
    provider: "openrouter",
    status: "available",
  },
];

interface OpenClawConfig {
  models?: {
    providers?: Record<
      string,
      {
        models?: Array<{
          id: string;
          name: string;
        }>;
      }
    >;
  };
}

function parseConfigModels(content: string): ModelInfo[] | null {
  try {
    const parsed: OpenClawConfig = JSON.parse(content);

    const models: ModelInfo[] = [];
    const seen = new Set<string>();

    const providers = parsed.models?.providers ?? {};
    for (const [providerName, provider] of Object.entries(providers)) {
      for (const model of provider.models ?? []) {
        // Normalize ID - remove openrouter/ prefix if present for consistency
        const id = model.id.replace(/^openrouter\//, "");
        if (!seen.has(id)) {
          seen.add(id);
          models.push({
            id,
            name: model.name || id,
            provider: providerName,
            status: "available",
          });
        }
      }
    }

    return models.length > 0 ? models : null;
  } catch {
    return null;
  }
}

export async function collectModels(): Promise<ModelInfo[]> {
  const now = Date.now();

  // Return cached models if valid (shorter TTL for fallback data)
  if (modelCache) {
    const ttl = modelCache.isFallback ? FALLBACK_CACHE_TTL_MS : CACHE_TTL_MS;
    if (now - modelCache.timestamp < ttl) {
      return modelCache.models;
    }
  }

  // Try to read from OpenClaw config
  const configPath = path.join(config.openclawHome, "openclaw.json");
  let liveModels: ModelInfo[] | null = null;
  try {
    const content = await fs.readFile(configPath, "utf-8");
    liveModels = parseConfigModels(content);
  } catch {
    // Config file not found or unreadable — fall through to fallback
  }

  const isFallback = liveModels === null;
  const models = liveModels ?? FALLBACK_MODELS;

  // Update cache
  modelCache = { models, timestamp: now, isFallback };

  return models;
}

// Exposed for testing
export function clearModelCache(): void {
  modelCache = null;
}

export function getModelCache(): CachedModels | null {
  return modelCache;
}
