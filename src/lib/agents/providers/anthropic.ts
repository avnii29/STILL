import { extractJsonObject } from "@/lib/agents/json";
import type { LanguageModel } from "@/lib/agents/types";

export function createAnthropicModel(opts: {
  apiKey: string;
  model: string;
}): LanguageModel {
  return {
    id: opts.model,
    provider: "anthropic",
    async completeJson<T>({ system, user }: { system: string; user: string; schemaName: string }) {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        signal: AbortSignal.timeout(30_000),
        headers: {
          "x-api-key": opts.apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: opts.model,
          max_tokens: 1024,
          temperature: 0,
          system,
          messages: [{ role: "user", content: user }],
        }),
      });

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Anthropic error ${response.status}: ${detail.slice(0, 400)}`);
      }

      const payload = (await response.json()) as {
        content?: Array<{ type: string; text?: string }>;
      };
      const content = payload.content?.find((part) => part.type === "text")?.text;
      if (!content) throw new Error("Anthropic returned an empty response.");
      return extractJsonObject(content) as T;
    },
  };
}
