import type { ModelInfo } from "../../shared/types.js";

export function collectModels(): ModelInfo[] {
  // Static list of available models via OpenRouter
  return [
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
}
