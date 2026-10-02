import { z } from "zod";

export const extractionSchema = z.object({
  is_commitment: z.boolean(),
  confidence: z.number().min(0).max(1),
  commitment_text: z.string(),
  normalized_commitment: z.string(),
  person: z.string().nullable(),
  deadline: z.string().nullable(),
  deadline_confidence: z.number().min(0).max(1),
  due_at: z.string().nullable(),
  evidence: z.string(),
  uncertain: z.boolean(),
});

export type Extraction = z.infer<typeof extractionSchema>;

const CASUAL =
  /\b(someday|sometime|some time|one day|at some point|whenever|if we ever|we should totally|coffee sometime|hang out sometime)\b/i;

const HEDGE =
  /\b(i('m| am) thinking|i think (i('ll| will)|maybe)|maybe i('ll| will)|i might|i may|considering|probably|not sure if)\b/i;

const EXPLICIT =
  /\b(i('ll| will)|i am going to|i'm going to|i told \w+ i('d| would)|i promised)\b/i;

const ACTION =
  /\b(send|share|forward|pay|transfer|call|text|message|introduce|handle|do|bring|drop|email|start|finish|apply|write|complete|review|submit|deliver|ship|fix|update)\b/i;

const NAME_STOP = new Set(
  [
    "i",
    "i'll",
    "me",
    "you",
    "we",
    "us",
    "the",
    "a",
    "an",
    "this",
    "that",
    "my",
    "our",
    "your",
    "tomorrow",
    "tonight",
    "today",
    "evening",
    "morning",
    "afternoon",
    "night",
    "week",
    "next",
    "project",
    "report",
    "database",
    "schema",
    "dataset",
    "document",
    "file",
    "revised",
  ].map((word) => word.toLowerCase()),
);

type DeadlineHit = {
  phrase: string;
  confidence: number;
  dueAt: Date;
};

export function extractPerson(text: string): string | null {
  const patterns = [
    /\b(?:told|tell|promised)\s+([A-Z][a-zA-Z]{1,30})\b/,
    /\b(?:send|share|email|forward|give|bring|text|call)\s+([A-Z][a-zA-Z]{1,30})\b/,
    /\b(?:to|with)\s+([A-Z][a-zA-Z]{1,30})\b/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const name = match?.[1];
    if (name && !NAME_STOP.has(name.toLowerCase())) return name;
  }
  return null;
}

export function extractDeadline(text: string, now = new Date()): DeadlineHit | null {
  const lower = text.toLowerCase();

  const at = (days: number, hour: number, minute = 0) => {
    const value = new Date(now);
    value.setDate(value.getDate() + days);
    value.setHours(hour, minute, 0, 0);
    return value;
  };

  if (/\btomorrow evening\b/.test(lower)) {
    return { phrase: "tomorrow evening", confidence: 0.86, dueAt: at(1, 18) };
  }
  if (/\btomorrow night\b/.test(lower)) {
    return { phrase: "tomorrow night", confidence: 0.84, dueAt: at(1, 20) };
  }
  if (/\btomorrow morning\b/.test(lower)) {
    return { phrase: "tomorrow morning", confidence: 0.84, dueAt: at(1, 9) };
  }
  if (/\btomorrow afternoon\b/.test(lower)) {
    return { phrase: "tomorrow afternoon", confidence: 0.84, dueAt: at(1, 14) };
  }
  if (/\btomorrow\b/.test(lower)) {
    return { phrase: "tomorrow", confidence: 0.8, dueAt: at(1, 9) };
  }
  if (/\btonight\b/.test(lower)) {
    return { phrase: "tonight", confidence: 0.88, dueAt: at(0, 20) };
  }
  if (/\btoday\b/.test(lower)) {
    return { phrase: "today", confidence: 0.78, dueAt: at(0, 18) };
  }
  if (/\bnext week\b/.test(lower)) {
    return { phrase: "next week", confidence: 0.45, dueAt: at(7, 9) };
  }
  const weekday = lower.match(
    /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/,
  );
  if (weekday?.[1]) {
    const names = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const target = names.indexOf(weekday[1]);
    const current = now.getDay();
    let days = (target - current + 7) % 7;
    if (days === 0) days = 7;
    return { phrase: weekday[1], confidence: 0.62, dueAt: at(days, 9) };
  }
  return null;
}

export function normalizeCommitment(text: string, person: string | null, deadline: string | null) {
  let value = text.replace(/\s+/g, " ").trim();
  value = value.replace(/^i told [A-Za-z]+ i('d| would)\s+/i, "");
  value = value.replace(/^(i('ll| will| am going to|'m going to)|i promised( to)?)\s+/i, "");
  if (person) value = value.replace(new RegExp(`\\b${person}\\b`, "gi"), " ");
  if (deadline) value = value.replace(new RegExp(deadline.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), " ");
  value = value.replace(/\b(the|a|an)\b/gi, " ");
  value = value.replace(/^[,\s]+|[.\s]+$/g, "").replace(/\s+/g, " ").trim();
  return value || text.trim();
}

export function extractCommitment(input: {
  text: string;
  personHint?: string;
  now?: Date;
}): Extraction {
  const evidence = input.text.replace(/\s+/g, " ").trim();
  const person = input.personHint?.trim() || extractPerson(evidence);
  const deadline = extractDeadline(evidence, input.now);
  const casual = CASUAL.test(evidence) && !/\b(tonight|tomorrow|today)\b/i.test(evidence);
  const hedge = HEDGE.test(evidence);
  const explicit = EXPLICIT.test(evidence) && ACTION.test(evidence);
  const namedTime = Boolean(deadline);
  const negated = /\bi (don't|do not) think i('ll| will)\b/i.test(evidence) || /\bi (won't|will not|am not going to)\b/i.test(evidence);
  const request = /\b(can you|could you|would you)\b.+\b(send|call|share|finish)\b/i.test(evidence);

  let isCommitment = explicit && !casual && !negated && !request;
  let uncertain = hedge && (explicit || namedTime) && !negated;
  let confidence = 0.12;

  if (negated || request) {
    isCommitment = false;
    uncertain = false;
    confidence = 0.88;
  } else if (casual && !explicit) {
    isCommitment = false;
    uncertain = false;
    confidence = 0.18;
  } else if (hedge && explicit) {
    isCommitment = false;
    uncertain = true;
    confidence = 0.42;
  } else if (explicit && namedTime) {
    isCommitment = true;
    confidence = 0.88;
  } else if (explicit) {
    isCommitment = true;
    confidence = 0.72;
  } else if (namedTime && ACTION.test(evidence)) {
    isCommitment = true;
    confidence = 0.58;
  }

  const normalized = normalizeCommitment(evidence, person, deadline?.phrase ?? null);

  return extractionSchema.parse({
    is_commitment: isCommitment,
    confidence,
    commitment_text: evidence,
    normalized_commitment: normalized,
    person,
    deadline: deadline?.phrase ?? null,
    deadline_confidence: deadline?.confidence ?? 0,
    due_at: deadline?.dueAt.toISOString() ?? null,
    evidence,
    uncertain,
  });
}

export function hoursUntil(dueAt: Date, now = new Date()) {
  return (dueAt.getTime() - now.getTime()) / 3_600_000;
}

export function scheduleRemindAt(dueAt: Date, now = new Date()) {
  const twoHoursBefore = new Date(dueAt.getTime() - 2 * 3_600_000);
  if (twoHoursBefore.getTime() > now.getTime() + 5 * 60_000) return twoHoursBefore;
  const thirtyMinutesBefore = new Date(dueAt.getTime() - 30 * 60_000);
  if (thirtyMinutesBefore.getTime() > now.getTime() + 5 * 60_000) return thirtyMinutesBefore;
  return new Date(now.getTime() + 60_000);
}
