import { extractJsonObject } from "@/lib/agents/json";
import type { LanguageModel } from "@/lib/agents/types";

export function createOpenAiModel(opts: { apiKey: string; model: string }): LanguageModel {
  return {
    id: opts.model,
    provider: "openai",
    async completeJson<T>({ system, user }: { system: string; user: string; schemaName: string }) {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${opts.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: opts.model,
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
      });

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`OpenAI error ${response.status}: ${detail.slice(0, 400)}`);
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = payload.choices?.[0]?.message?.content;
      if (!content) throw new Error("OpenAI returned an empty response.");
      return extractJsonObject(content) as T;
    },
  };
}
