import Anthropic from "@anthropic-ai/sdk";
import { config } from "@/lib/config";

// Shared Anthropic client for the ingestion LLM stages (classify, lesson).
// Lazily constructed so the rest of the app boots without a key.

let cached: Anthropic | null = null;

export function anthropicClient(): Anthropic {
  if (cached) return cached;
  if (!config.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  cached = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });
  return cached;
}
