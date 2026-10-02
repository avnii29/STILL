import type { LanguageModel, ResolutionLook } from "@/lib/agents/types";

export function heuristicResolution(input: {
  original: string;
  laterMessages: string[];
}): ResolutionLook {
  const blob = input.laterMessages.join("\n").toLowerCase();
  if (!blob.trim()) {
    return {
      likelyResolved: false,
      evidence: "No later conversation was provided.",
      uncertainty: "Without later messages, Still cannot tell if this was fulfilled.",
    };
  }

  if (/\b(sent|done|already (did|sent|paid|called)|here (it|you) go|paid)\b/.test(blob)) {
    return {
      likelyResolved: true,
      kind: "FULFILLED",
      evidence: "Later wording suggests the original thing may have happened.",
      uncertainty: "This is a guess from language, not proof.",
    };
  }
  if (/\b(never mind|don't worry about it|cancel|no need)\b/.test(blob)) {
    return {
      likelyResolved: true,
      kind: "CANCELLED",
      evidence: "Later wording suggests this was called off.",
      uncertainty: "The speaker may have been polite rather than final.",
    };
  }
  if (/\b(instead|changed plans|something else)\b/.test(blob)) {
    return {
      likelyResolved: true,
      kind: "SUPERSEDED",
      evidence: "A later plan may have replaced this one.",
      uncertainty: "The original commitment might still stand.",
    };
  }

  return {
    likelyResolved: false,
    evidence: "Later messages do not clearly close this.",
    uncertainty: "It may still be open.",
  };
}

export async function runResolutionAgent(input: {
  original: string;
  laterMessages: string[];
  model: LanguageModel | null;
}): Promise<ResolutionLook> {
  const fallback = heuristicResolution(input);
  if (!input.model) return fallback;

  try {
    const raw = await input.model.completeJson<ResolutionLook>({
      schemaName: "resolution_look",
      system:
        "Decide if later conversation shows an earlier human commitment was fulfilled, superseded, cancelled, or became irrelevant. Do not invent evidence. Return JSON: likelyResolved, kind, evidence, uncertainty.",
      user: `Original: ${input.original}\nLater:\n${input.laterMessages.join("\n") || "(none)"}`,
    });
    return {
      likelyResolved: Boolean(raw.likelyResolved),
      kind: raw.kind,
      evidence: raw.evidence || fallback.evidence,
      uncertainty: raw.uncertainty || "This is uncertain.",
    };
  } catch {
    return fallback;
  }
}
