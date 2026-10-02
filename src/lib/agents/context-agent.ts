import type { AgentMessage, DetectionResult, LanguageModel } from "@/lib/agents/types";
import { formatSlice, sliceAround } from "@/lib/agents/ingestion";
import {
  heuristicDetection,
  titleFromEvidence,
  detectCommitmentHeuristic,
} from "@/lib/agents/commitment-detector";
import { extractCommitment } from "@/lib/agents/extract";
import { threadDetectionSchema } from "@/lib/validation/schemas";

const SYSTEM = `You interpret human conversation for unfinished commitments.
A task has an action. A human thread has CONTEXT.
Distinguish casual someday-talk from a real promise, request, plan, reminder, or waiting state.
Do not invent facts. Do not infer emotions as facts. Phrase uncertainty explicitly.
Return JSON only with keys: is_thread, confidence, type, evidence, context, current_state, suggested_action, needs_user_review.
type must be one of EXPLICIT_PROMISE, REQUEST, FUTURE_INTENTION, RECIPROCAL_PLAN, REMINDER_REQUEST, WAITING_STATE, SELF_COMMITMENT.`;

export async function runContextAgent(input: {
  message: AgentMessage;
  messages: AgentMessage[];
  index: number;
  personName?: string;
  model: LanguageModel | null;
}): Promise<DetectionResult | null> {
  const slice = sliceAround(input.messages, input.index);
  const surrounding = formatSlice(slice);
  const heuristic = heuristicDetection(input.message, surrounding);
  const hit = detectCommitmentHeuristic(input.message);
  const extracted = extractCommitment({
    text: input.message.body,
    personHint: input.personName,
  });

  if (!input.model) {
    if (!heuristic || !hit) return null;
    return withExtraction(heuristic, hit.owner, input.personName, extracted, {
      interpretedBy: "heuristic",
      provider: "none",
    });
  }

  try {
    const raw = await input.model.completeJson<unknown>({
      schemaName: "thread_detection",
      system: SYSTEM,
      user: `Person (if known): ${input.personName ?? "unknown"}
Focus line: ${input.message.speaker}: ${input.message.body}
Surrounding conversation:
${surrounding}

If this is idle someday-talk, set is_thread false and keep confidence low.`,
    });
    const parsed = threadDetectionSchema.parse(raw);
    const owner = hit?.owner ?? inferOwner(parsed.type, input.message.isFromUser);
    return withExtraction(parsed, owner, input.personName, extracted, {
      interpretedBy: "llm",
      provider: input.model.provider,
      model: input.model.id,
    });
  } catch {
    if (!heuristic || !hit) return null;
    return withExtraction(heuristic, hit.owner, input.personName, extracted, {
      interpretedBy: "heuristic",
      provider: input.model.provider,
    });
  }
}

function withExtraction(
  detection: import("@/lib/validation/schemas").ThreadDetection,
  owner: DetectionResult["owner"],
  personHint: string | undefined,
  extracted: ReturnType<typeof extractCommitment>,
  meta: DetectionResult["meta"],
): DetectionResult {
  const confirmed = extracted.is_commitment && detection.is_thread;
  return {
    ...detection,
    is_thread: confirmed,
    confidence: confirmed ? Math.max(detection.confidence, extracted.confidence) : extracted.confidence,
    needs_user_review: true,
    title: extracted.normalized_commitment || titleFromEvidence(detection.evidence || extracted.evidence),
    owner,
    personName: extracted.person ?? personHint,
    suggestedFollowUpAt: extracted.due_at,
    normalizedCommitment: extracted.normalized_commitment,
    deadlineConfidence: extracted.deadline_confidence,
    uncertain: extracted.uncertain,
    evidence: extracted.evidence,
    meta,
  };
}

function inferOwner(
  type: DetectionResult["type"],
  isFromUser: boolean,
): DetectionResult["owner"] {
  if (type === "SELF_COMMITMENT" || type === "REMINDER_REQUEST") return "SELF";
  if (type === "RECIPROCAL_PLAN") return "SHARED";
  if (type === "REQUEST") return isFromUser ? "THEM" : "ME";
  return isFromUser ? "ME" : "THEM";
}
