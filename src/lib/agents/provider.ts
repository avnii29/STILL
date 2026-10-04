import "server-only";

import { getServerEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import type { LanguageModel } from "@/lib/agents/types";
import { createAnthropicModel } from "@/lib/agents/providers/anthropic";
import { createOpenAiModel } from "@/lib/agents/providers/openai";
export { extractJsonObject } from "@/lib/agents/json";

export function getLanguageModel(): LanguageModel | null {
  const env = getServerEnv();
  if (env.AI_PROVIDER === "none") return null;

  try {
    if (env.AI_PROVIDER === "openai") {
      if (!env.OPENAI_API_KEY) {
        logger.warn("ai.provider.missing_key", { provider: "openai" });
        return null;
      }
      return createOpenAiModel({
        apiKey: env.OPENAI_API_KEY,
        model: env.AI_MODEL ?? "gpt-4.1-mini",
        baseUrl: env.AI_BASE_URL,
      });
    }
    if (env.AI_PROVIDER === "anthropic") {
      if (!env.ANTHROPIC_API_KEY) {
        logger.warn("ai.provider.missing_key", { provider: "anthropic" });
        return null;
      }
      return createAnthropicModel({
        apiKey: env.ANTHROPIC_API_KEY,
        model: env.AI_MODEL ?? "claude-sonnet-4-5",
      });
    }
  } catch (error) {
    logger.error("ai.provider.init_failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
  }
  return null;
}
