import { extractCommitment, extractDeadline, extractionSchema, type Extraction } from "@/lib/agents/extract";
import { logger } from "@/lib/logger";
import type { LanguageModel } from "@/lib/agents/types";

export type CommitmentReading = {
  text: string;
  extraction: Extraction;
  interpretedBy: string;
  provider: string;
};

const SYSTEM = `You extract at most one commitment from a note. Return one JSON object and nothing else.
Keys, exactly:
is_commitment (boolean),
confidence (number from 0 to 1),
commitment_text (the note, unchanged),
normalized_commitment (a short restatement, or the note),
person (string or null),
deadline (the phrase they used, such as "Tuesday evening", or null),
deadline_confidence (number from 0 to 1),
due_at (ISO-8601 string or null),
evidence (the note, unchanged),
uncertain (boolean).

A commitment is a real promise to do something.
These are not commitments: "I'll try", "I might", "maybe", "someday", questions, and refusals. For those, is_commitment is false, uncertain is false, and confidence stays below 0.4.
A short confirmation such as "yep" or "yes" that only adds a deadline to a promise already present in the context IS a commitment. Copy the person from the context. Never invent a person, a fact, or a clock time that is not in the note or the context.
If they named a weekday and a part of the day but no clock, set deadline to that phrase and set due_at using morning 09:00, afternoon 14:00, evening 18:00, night 20:00 in the local time given below. If there is no deadline, deadline and due_at are null.`;

export async function readCommitment(input: {
  text: string;
  personHint?: string;
  context?: string;
  now?: Date;
  model: LanguageModel | null;
}): Promise<CommitmentReading> {
  const text = input.text.replace(/\s+/g, " ").trim();
  const fallback = (interpretedBy: "heuristic" | "heuristic:fallback"): CommitmentReading => ({
    text,
    extraction: extractCommitment({
      text,
      personHint: input.personHint,
      context: input.context,
      now: input.now,
    }),
    interpretedBy,
    provider: interpretedBy,
  });

  if (!input.model) return fallback("heuristic");

  try {
    const raw = await input.model.completeJson<unknown>({
      schemaName: "commitment_extraction",
      system: SYSTEM,
      user: [
        `Local time now: ${(input.now ?? new Date()).toString()}`,
        input.personHint ? `Person hint: ${input.personHint}` : "Person hint: none",
        input.context?.trim() ? `Context:\n${input.context.trim()}` : "Context: none",
        `Note:\n${text}`,
      ].join("\n\n"),
    });
    const parsed = extractionSchema.parse(coerceExtraction(raw));
    return {
      text,
      extraction: groundExtraction(parsed, text, input),
      interpretedBy: `model:${input.model.provider}`,
      provider: `${input.model.provider}:${input.model.id}`,
    };
  } catch (error) {
    logger.warn("commitment.read.fallback", {
      provider: input.model.provider,
      model: input.model.id,
      error: error instanceof Error ? error.message.slice(0, 300) : "unknown",
    });
    return fallback("heuristic:fallback");
  }
}

function coerceExtraction(raw: unknown) {
  if (!raw || typeof raw !== "object") return raw;
  const value = { ...(raw as Record<string, unknown>) };
  for (const key of ["confidence", "deadline_confidence"] as const) {
    const number = typeof value[key] === "string" ? Number(value[key]) : value[key];
    if (typeof number === "number" && Number.isFinite(number)) {
      value[key] = number > 1 && number <= 100 ? number / 100 : number;
    }
  }
  for (const key of ["person", "deadline", "due_at"] as const) {
    if (value[key] === "") value[key] = null;
  }
  if (value.is_commitment === "true") value.is_commitment = true;
  if (value.is_commitment === "false") value.is_commitment = false;
  if (value.uncertain === "true") value.uncertain = true;
  if (value.uncertain === "false") value.uncertain = false;
  return value;
}

function groundExtraction(
  parsed: Extraction,
  text: string,
  input: { personHint?: string; context?: string; now?: Date },
): Extraction {
  const sources = [text, input.context ?? "", input.personHint ?? ""].join("\n").toLowerCase();
  const person =
    parsed.person && sources.includes(parsed.person.toLowerCase()) ? parsed.person : null;
  let deadline = parsed.deadline;
  let dueAt = parsed.due_at && !Number.isNaN(Date.parse(parsed.due_at)) ? parsed.due_at : null;
  if (!dueAt) {
    const fromPhrase = extractDeadline(`${text} ${deadline ?? ""}`, input.now);
    if (fromPhrase && (!deadline || fromPhrase.phrase.toLowerCase() === deadline.toLowerCase() || text.toLowerCase().includes(fromPhrase.phrase))) {
      deadline = deadline ?? fromPhrase.phrase;
      dueAt = fromPhrase.dueAt.toISOString();
    }
  }
  return extractionSchema.parse({
    ...parsed,
    commitment_text: text,
    evidence: text,
    person,
    deadline,
    due_at: dueAt,
  });
}
