import type { LanguageModel, SocialAdvice } from "@/lib/agents/types";

export function heuristicSocialAdvice(input: {
  type: string;
  confidence: number;
  evidence: string;
}): SocialAdvice {
  const vague = /\b(someday|one day|if we ever|we should totally)\b/i.test(input.evidence);
  if (vague || input.confidence < 0.45) {
    return {
      shouldSurface: false,
      reason: "This sounds more like atmosphere than a commitment you would want to be reminded of.",
      caution:
        "Still is not claiming anyone meant this seriously. If you know it mattered, you can keep it.",
    };
  }

  return {
    shouldSurface: true,
    reason: "The wording looks specific enough that remembering it might actually help you.",
    caution:
      "Still does not know how this relationship feels. It is only looking at unfinished language.",
  };
}

export async function runSocialContextAgent(input: {
  type: string;
  confidence: number;
  evidence: string;
  context: string;
  model: LanguageModel | null;
}): Promise<SocialAdvice> {
  const fallback = heuristicSocialAdvice(input);
  if (!input.model) return fallback;

  try {
    const raw = await input.model.completeJson<SocialAdvice>({
      schemaName: "social_advice",
      system: `Decide whether surfacing this unfinished conversation would help the user remember something they meant.
Do not diagnose the relationship. Do not infer hidden feelings. Phrase uncertainty explicitly.
Return JSON: shouldSurface, reason, caution.`,
      user: `type=${input.type}\nconfidence(internal)=${input.confidence}\nevidence=${input.evidence}\ncontext=${input.context}`,
    });
    return {
      shouldSurface: Boolean(raw.shouldSurface),
      reason: raw.reason || fallback.reason,
      caution:
        raw.caution ||
        "Still cannot see the relationship. This is only a language-level suggestion.",
    };
  } catch {
    return fallback;
  }
}
