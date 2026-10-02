import { z } from "zod";
import { extractPerson, normalizeCommitment } from "@/lib/agents/extract";
import { resolveTemporal, type DeadlinePrecision } from "@/lib/sources/temporal";

export const commitmentDetectionSchema = z.object({
  classification: z.enum([
    "COMMITMENT",
    "REMINDER_REQUEST",
    "POSSIBLE_COMMITMENT",
    "RESOLUTION_SIGNAL",
    "NON_COMMITMENT",
    "EXTERNAL_COMMITMENT",
  ]),
  confidence: z.number().min(0).max(1),
  commitment_text: z.string(),
  normalized_commitment: z.string(),
  actor: z.enum(["ME", "THEM", "REQUEST_TO_ME", "EXTERNAL", "NONE"]),
  target_person: z.string().nullable(),
  deadline: z.string().nullable(),
  deadline_confidence: z.number().min(0).max(1),
  due_at: z.string().nullable(),
  deadline_precision: z.enum(["EXACT", "DAY_PART", "DAY", "RANGE", "UNSPECIFIED"]).nullable(),
  evidence_span: z.string(),
  reasoning_summary: z.string(),
  ask_when: z.boolean(),
  when_prompt: z.string().nullable(),
});

export type CommitmentDetection = z.infer<typeof commitmentDetectionSchema>;

const NEGATION =
  /\b(i (don't|do not|won't|will not|am not going to|can't|cannot) think i('ll| will)|i (don't|do not) think i('ll| will)|i (won't|will not|am not going to)|i can't|i cannot)\b/i;

const REMINDER =
  /\b(remind me|don't let me forget|do not let me forget|nudge me|can you remember that i need)\b/i;

const REQUEST_TO_OTHER =
  /\b(can you|could you|would you|will you)\b.+\b(send|share|call|bring|do|finish|submit|pay)\b/i;

const THIRD_PARTY =
  /\b([A-Z][a-zA-Z]{1,20})\s+said\s+(he('ll| will)|she('ll| will)|they('ll| will)|he'd|she'd)\b/;

const HEDGE = /\b(i might|i may|maybe i('ll| will)|i('m| am) thinking|probably|not sure)\b/i;
const EXPLICIT = /\b(i('ll| will)|i am going to|i'm going to|i told \w+ i('d| would)|i promised)\b/i;
const ACTION =
  /\b(send|share|forward|pay|call|text|submit|finish|start|apply|write|deliver|bring|email|handle)\b/i;
const RESOLUTION = /\b(i sent it|sent it|it's done|its done|done\.|here's the|just emailed|already sent)\b/i;
const CASUAL = /\b(sometime|someday|we should (probably )?(meet|get coffee|hang))\b/i;

export function scoreRelevance(text: string) {
  const lower = text.toLowerCase();
  if (REMINDER.test(lower) || EXPLICIT.test(lower) || RESOLUTION.test(lower)) return "HIGH" as const;
  if (REQUEST_TO_OTHER.test(lower) || HEDGE.test(lower) || /\b(tomorrow|tonight|friday|deadline)\b/i.test(lower)) {
    return "MEDIUM" as const;
  }
  if (CASUAL.test(lower)) return "LOW" as const;
  if (ACTION.test(lower)) return "LOW" as const;
  return "NONE" as const;
}

export function detectCommitment(input: {
  text: string;
  isFromUser?: boolean;
  personHint?: string;
  now?: Date;
  timeZone?: string;
}): CommitmentDetection {
  const evidence = input.text.replace(/\s+/g, " ").trim();
  const isFromUser = input.isFromUser !== false;
  const temporal = resolveTemporal({ text: evidence, now: input.now, timeZone: input.timeZone });
  const person = input.personHint?.trim() || extractPerson(evidence);
  const normalized = normalizeCommitment(evidence, person, temporal?.original ?? null);

  const negated = NEGATION.test(evidence) || /\bi don't think i('ll| will)\b/i.test(evidence);
  const reminder = REMINDER.test(evidence);
  const request = REQUEST_TO_OTHER.test(evidence);
  const third = evidence.match(THIRD_PARTY);
  const hedge = HEDGE.test(evidence);
  const explicit = EXPLICIT.test(evidence) && ACTION.test(evidence);
  const resolution = RESOLUTION.test(evidence);
  const casual = CASUAL.test(evidence) && !/\b(tonight|tomorrow|today|friday)\b/i.test(evidence);

  let classification: CommitmentDetection["classification"] = "NON_COMMITMENT";
  let confidence = 0.12;
  let actor: CommitmentDetection["actor"] = "NONE";
  let reasoning = "No commitment language stood out.";

  if (negated) {
    classification = "NON_COMMITMENT";
    confidence = 0.9;
    reasoning = "The wording denies or doubts the action. Still will not remember it.";
  } else if (reminder) {
    classification = "REMINDER_REQUEST";
    confidence = temporal?.precision === "EXACT" ? 0.94 : 0.86;
    actor = "ME";
    reasoning = "You asked STILL to remember this.";
  } else if (third) {
    classification = "EXTERNAL_COMMITMENT";
    confidence = 0.82;
    actor = "EXTERNAL";
    reasoning = "Someone else made this promise. It is not yours unless you ask STILL to track it.";
  } else if (request) {
    classification = isFromUser ? "NON_COMMITMENT" : "POSSIBLE_COMMITMENT";
    confidence = 0.58;
    actor = isFromUser ? "THEM" : "REQUEST_TO_ME";
    reasoning = isFromUser
      ? "You asked someone else to do this. STILL will not treat it as your commitment."
      : "Someone asked you. Confirm if you want STILL to keep it.";
  } else if (resolution) {
    classification = "RESOLUTION_SIGNAL";
    confidence = 0.7;
    actor = "ME";
    reasoning = "This may close an existing thread. STILL will not invent a new one.";
  } else if (casual) {
    classification = "NON_COMMITMENT";
    confidence = 0.8;
    reasoning = "This is open-ended conversation, not a commitment.";
  } else if (hedge && (explicit || temporal)) {
    classification = "POSSIBLE_COMMITMENT";
    confidence = 0.44;
    actor = "ME";
    reasoning = "Sounds like you might be planning this. STILL will not store it unless you say so.";
  } else if (explicit) {
    classification = "COMMITMENT";
    confidence = temporal ? 0.9 : 0.76;
    actor = "ME";
    reasoning = "You said you would do this.";
  } else if (temporal && ACTION.test(evidence) && isFromUser) {
    classification = "POSSIBLE_COMMITMENT";
    confidence = 0.5;
    actor = "ME";
    reasoning = "A time was named, but the promise is not fully explicit.";
  }

  return commitmentDetectionSchema.parse({
    classification,
    confidence,
    commitment_text: evidence,
    normalized_commitment: normalized,
    actor,
    target_person: third?.[1] ?? person,
    deadline: temporal?.original ?? null,
    deadline_confidence: temporal?.confidence ?? 0,
    due_at: temporal?.dueAt?.toISOString() ?? null,
    deadline_precision: (temporal?.precision as DeadlinePrecision | undefined) ?? null,
    evidence_span: evidence,
    reasoning_summary: reasoning,
    ask_when: Boolean(temporal?.askUser) || (reminder && !temporal?.dueAt),
    when_prompt: temporal?.prompt ?? (reminder && !temporal?.dueAt ? "When should I remind you?" : null),
  });
}

export function shouldInterrupt(detection: CommitmentDetection) {
  if (detection.classification === "NON_COMMITMENT") return false;
  if (detection.classification === "EXTERNAL_COMMITMENT") return false;
  if (detection.classification === "RESOLUTION_SIGNAL") return false;
  return true;
}
