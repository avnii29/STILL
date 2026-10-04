import type { AgentMessage, DetectionResult, LanguageModel } from "@/lib/agents/types";
import { formatSlice, sliceAround } from "@/lib/agents/ingestion";
import {
  heuristicDetection,
  titleFromEvidence,
  detectCommitmentHeuristic,
} from "@/lib/agents/commitment-detector";
import type { Extraction } from "@/lib/agents/extract";
import { readCommitment, type CommitmentReading } from "@/lib/agents/read-commitment";
import { threadDetectionSchema, type ThreadDetection } from "@/lib/validation/schemas";

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
  context?: string;
  model: LanguageModel | null;
  reading?: CommitmentReading;
}): Promise<DetectionResult | null> {
  const slice = sliceAround(input.messages, input.index);
  const surrounding = formatSlice(slice);
  const context = input.context?.trim() || surrounding;
  const reading =
    input.reading && input.reading.text === input.message.body.trim()
      ? input.reading
      : await readCommitment({
          text: input.message.body,
          personHint: input.personName,
          context,
          model: input.model,
        });
  const extracted = reading.extraction;
  const heuristic = heuristicDetection(input.message, surrounding);
  const hit = detectCommitmentHeuristic(input.message);
  const meta: DetectionResult["meta"] = {
    interpretedBy: reading.interpretedBy,
    provider: reading.provider,
    model: input.model?.id,
  };

  if (reading.interpretedBy.startsWith("model:") && !extracted.is_commitment && !extracted.uncertain) {
    return null;
  }

  if (!reading.interpretedBy.startsWith("model:")) {
    if (extracted.is_commitment && (!heuristic || !hit)) {
      const owner = hit?.owner ?? (input.message.isFromUser ? "ME" : "THEM");
      return withExtraction(detectionFromExtraction(extracted, context), owner, input.personName, extracted, meta);
    }
    if (!heuristic || !hit) return null;
    return withExtraction(heuristic, hit.owner, input.personName, extracted, meta);
  }

  try {
    const raw = await input.model!.completeJson<unknown>({
      schemaName: "thread_detection",
      system: SYSTEM,
      user: `Person (if known): ${input.personName ?? extracted.person ?? "unknown"}
Focus line: ${input.message.speaker}: ${input.message.body}
Surrounding conversation:
${context}

If this is idle someday-talk, set is_thread false and keep confidence low.`,
    });
    const parsed = threadDetectionSchema.parse(raw);
    const owner = hit?.owner ?? inferOwner(parsed.type, input.message.isFromUser);
    return withExtraction(parsed, owner, input.personName, extracted, meta);
  } catch {
    const owner = hit?.owner ?? (input.message.isFromUser ? "ME" : "THEM");
    return withExtraction(detectionFromExtraction(extracted, context), owner, input.personName, extracted, meta);
  }
}

function withExtraction(
  detection: ThreadDetection,
  owner: DetectionResult["owner"],
  personHint: string | undefined,
  extracted: Extraction,
  meta: DetectionResult["meta"],
): DetectionResult {
  const confirmed = meta.interpretedBy.startsWith("model:")
    ? extracted.is_commitment
    : extracted.is_commitment && detection.is_thread;
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
    extraction: extracted,
    meta,
  };
}

function detectionFromExtraction(extracted: Extraction, context: string): ThreadDetection {
  return threadDetectionSchema.parse({
    is_thread: extracted.is_commitment,
    confidence: extracted.confidence,
    type: "EXPLICIT_PROMISE",
    evidence: extracted.evidence,
    context: context || "No extra surrounding conversation was provided.",
    current_state: extracted.is_commitment
      ? "This still looks unfinished, pending your review."
      : "This does not look like a commitment.",
    suggested_action: "Do the thing, or mark it waiting if you already started.",
    needs_user_review: true,
  });
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
