import { spawn } from "node:child_process";
import { anthropicClient } from "@/ingest/anthropic";
import { config } from "@/lib/config";

// Structured-JSON LLM helper shared by the classify + lesson stages. Two
// backends, selected by config.LLM_PROVIDER:
//   - "api": the Messages API with a forced json_schema + cached system prompt.
//   - "claude_cli": shell out to `claude -p --output-format json`, which runs
//     on a Claude subscription (no API credits). For local testing only — it
//     can't force the schema, so we instruct JSON and validate downstream.

export type StructuredArgs = {
  system: string;
  user: string;
  schema: Record<string, unknown>; // used by the API backend
  maxTokens: number; // used by the API backend
};

/** Pull a bare JSON object out of model text (strips ``` fences / surrounding
 * prose). The API backend already returns clean JSON; the CLI may not. */
export function extractJsonObject(text: string): string {
  let t = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(t);
  if (fenced) t = fenced[1]!.trim();
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first >= 0 && last > first) t = t.slice(first, last + 1);
  return t;
}

export async function completeStructuredJson(
  args: StructuredArgs,
): Promise<{ text: string; model: string }> {
  if (config.LLM_PROVIDER === "claude_cli") return viaClaudeCli(args);
  return viaApi(args);
}

async function viaApi({ system, user, schema, maxTokens }: StructuredArgs) {
  const message = await anthropicClient().messages.create({
    model: config.ANTHROPIC_MODEL,
    max_tokens: maxTokens,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: user }],
    output_config: { format: { type: "json_schema", schema } },
  });
  const text = message.content.find((b) => b.type === "text")?.text;
  if (!text) throw new Error("LLM returned no text block");
  return { text: extractJsonObject(text), model: message.model };
}

type CliEnvelope = {
  is_error?: boolean;
  subtype?: string;
  result?: string;
  modelUsage?: Record<string, unknown>;
};

async function viaClaudeCli({ system, user, schema }: StructuredArgs) {
  // The CLI can't enforce the schema, so hand it to the model in the prompt
  // (gives it the exact enum values etc.) and validate downstream.
  const prompt =
    `${system}\n\n${user}\n\nReturn ONLY a single JSON object that strictly conforms to this JSON Schema ` +
    `(use only the allowed enum values; no prose, no markdown code fences):\n${JSON.stringify(schema)}`;
  const raw = await runClaude(prompt);
  const env = JSON.parse(raw) as CliEnvelope;
  if (env.is_error || typeof env.result !== "string") {
    throw new Error(`claude cli error: ${env.subtype ?? "unknown"} ${env.result ?? ""}`);
  }
  const model = env.modelUsage
    ? (Object.keys(env.modelUsage)[0] ?? "claude-cli")
    : "claude-cli";
  return { text: extractJsonObject(env.result), model };
}

function runClaude(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // Strip API creds so the CLI authenticates with the Claude subscription
    // (an inherited ANTHROPIC_API_KEY/AUTH_TOKEN would force API mode + billing).
    const env = { ...process.env };
    delete env.ANTHROPIC_API_KEY;
    delete env.ANTHROPIC_AUTH_TOKEN;
    const child = spawn(
      config.CLAUDE_CLI_BIN,
      ["-p", "--output-format", "json", "--model", config.ANTHROPIC_MODEL, "--max-turns", "1"],
      { stdio: ["pipe", "pipe", "pipe"], env },
    );
    let out = "";
    let err = "";
    child.stdout.on("data", (d: Buffer) => (out += d.toString()));
    child.stderr.on("data", (d: Buffer) => (err += d.toString()));
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0
        ? resolve(out)
        : reject(new Error(`claude exited ${code}: ${err.trim()}`)),
    );
    child.stdin.write(prompt);
    child.stdin.end();
  });
}
