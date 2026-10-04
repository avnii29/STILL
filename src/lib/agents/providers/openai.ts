import { extractJsonObject } from "@/lib/agents/json";
import type { LanguageModel } from "@/lib/agents/types";

export function createOpenAiModel(opts: {
  apiKey: string;
  model: string;
  baseUrl?: string;
}): LanguageModel {
  const root = (opts.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "");
  return {
    id: opts.model,
    provider: "openai",
    async completeJson<T>({ system, user }: { system: string; user: string; schemaName: string }) {
      const content = await complete(root, opts, system, user, true);
      return extractJsonObject(content) as T;
    },
  };
}

async function complete(
  root: string,
  opts: { apiKey: string; model: string },
  system: string,
  user: string,
  jsonMode: boolean,
): Promise<string> {
  const response = await fetch(`${root}/chat/completions`, {
    method: "POST",
    signal: AbortSignal.timeout(30_000),
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model,
      temperature: 0,
      max_tokens: 800,
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    if (jsonMode && response.status === 400) {
      return complete(root, opts, system, user, false);
    }
    throw new Error(`OpenAI error ${response.status}: ${detail.slice(0, 400)}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  const content = messageText(payload.choices?.[0]?.message?.content);
  if (!content) throw new Error("OpenAI returned an empty response.");
  return content;
}

function messageText(content: unknown) {
  const raw = Array.isArray(content)
    ? content.map((part) => (part && typeof part === "object" && "text" in part ? String(part.text ?? "") : "")).join("")
    : typeof content === "string"
      ? content
      : "";
  return raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}
