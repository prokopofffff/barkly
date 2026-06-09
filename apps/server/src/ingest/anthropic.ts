import Anthropic from "@anthropic-ai/sdk";
import { config } from "@/lib/config";

// Shared Anthropic client for the ingestion LLM stages (classify, lesson).
// Lazily constructed so the rest of the app boots without a key.

/** True when either Anthropic credential is configured. */
export function hasAnthropicCreds(): boolean {
  return Boolean(config.ANTHROPIC_AUTH_TOKEN || config.ANTHROPIC_API_KEY);
}

let cached: Anthropic | null = null;

export function anthropicClient(): Anthropic {
  if (cached) return cached;
  // Prefer an OAuth bearer token when present, else the x-api-key.
  if (config.ANTHROPIC_AUTH_TOKEN) {
    cached = new Anthropic({ authToken: config.ANTHROPIC_AUTH_TOKEN });
  } else if (config.ANTHROPIC_API_KEY) {
    cached = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });
  } else {
    throw new Error("Set ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN");
  }
  return cached;
}
