import type { CommitmentType } from "@/generated/prisma/client";
import type { AgentMessage } from "@/lib/agents/types";
import { threadDetectionSchema, type ThreadDetection } from "@/lib/validation/schemas";

const SOMEDAY =
  /\b(someday|sometime|some time|one day|at some point|whenever|if we ever|we should totally)\b/i;

const EXPLICIT_PROMISE =
  /\b(i('ll| will)|i am going to|i'm going to|i told \w+ i('d| would))\s+(send|share|forward|pay|transfer|call|text|message|introduce|handle|do|bring|drop|email|start|finish|apply|write|complete|review|submit|deliver|ship|get)\b/i;

const REQUEST =
  /\b(can you|could you|would you|please)\b.+\b(send|call|share|remind|introduce|pay)\b/i;

const FUTURE_INTENTION =
  /\b(after (this )?(semester|exams?|work)|when i (get|reach|land|arrive)|once i)\b/i;

const RECIPROCAL =
  /\b(we should|let'?s|shall we)\b/i;

const REMINDER = /\b(remind me|don't let me forget|nudge me)\b/i;

const WAITING = /\b(let me know|i'll wait|waiting (for|on)|when you (can|get a chance))\b/i;

const SELF =
  /\b(i need to|i keep meaning to|i still haven't|i promised myself|i should finally)\b/i;

export type HeuristicHit = {
  type: CommitmentType;
  confidence: number;
  owner: "ME" | "THEM" | "SHARED" | "SELF";
};

export function detectCommitmentHeuristic(
  message: AgentMessage,
): HeuristicHit | null {
  const text = message.body;
  if (text.length < 8) return null;

  const vague = SOMEDAY.test(text) && !/\b(tonight|tomorrow|today|this week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(text);

  if (REMINDER.test(text)) {
    return { type: "REMINDER_REQUEST", confidence: vague ? 0.35 : 0.78, owner: "SELF" };
  }
  if (/\bif i (get|have|find) time\b/i.test(text)) {
    return { type: "FUTURE_INTENTION", confidence: 0.4, owner: message.isFromUser ? "ME" : "THEM" };
  }
  if (EXPLICIT_PROMISE.test(text)) {
    const owner = message.isFromUser ? "ME" : "THEM";
    return { type: "EXPLICIT_PROMISE", confidence: vague ? 0.32 : 0.84, owner };
  }
  if (REQUEST.test(text)) {
    return {
      type: "REQUEST",
      confidence: vague ? 0.3 : 0.72,
      owner: message.isFromUser ? "THEM" : "ME",
    };
  }
  if (WAITING.test(text)) {
    return { type: "WAITING_STATE", confidence: 0.66, owner: message.isFromUser ? "THEM" : "ME" };
  }
  if (RECIPROCAL.test(text)) {
    return { type: "RECIPROCAL_PLAN", confidence: vague ? 0.28 : 0.7, owner: "SHARED" };
  }
  if (FUTURE_INTENTION.test(text) || SELF.test(text)) {
    return {
      type: message.isFromUser ? "SELF_COMMITMENT" : "FUTURE_INTENTION",
      confidence: vague ? 0.34 : 0.68,
      owner: message.isFromUser ? "SELF" : "THEM",
    };
  }
  if (vague) {
    return { type: "FUTURE_INTENTION", confidence: 0.25, owner: "SHARED" };
  }
  return null;
}

export function heuristicDetection(
  message: AgentMessage,
  surrounding: string,
): ThreadDetection | null {
  const hit = detectCommitmentHeuristic(message);
  if (!hit) return null;

  const isVague = hit.confidence < 0.45;
  return threadDetectionSchema.parse({
    is_thread: !isVague,
    confidence: hit.confidence,
    type: hit.type,
    evidence: message.body,
    context: surrounding || "No extra surrounding conversation was provided.",
    current_state: isVague
      ? "The wording is too open-ended to treat as a living commitment."
      : "This still looks unfinished, pending your review.",
    suggested_action: isVague
      ? "Leave it unless you know this actually matters."
      : suggestedActionFor(hit.type, hit.owner),
    needs_user_review: true,
  });
}

export function suggestedActionFor(type: CommitmentType, owner: HeuristicHit["owner"]) {
  if (type === "REMINDER_REQUEST") return "Keep this nearby until you have told them.";
  if (type === "SELF_COMMITMENT") return "Decide whether this is still something you mean.";
  if (owner === "ME") return "Do the thing, or mark it waiting if you already started.";
  if (owner === "THEM") return "Wait, or ask once if enough time has passed.";
  return "Confirm whether this plan is still real.";
}

export function titleFromEvidence(evidence: string) {
  const cleaned = evidence.replace(/\s+/g, " ").trim();
  if (cleaned.length <= 72) return cleaned;
  return `${cleaned.slice(0, 69).trim()}…`;
}
