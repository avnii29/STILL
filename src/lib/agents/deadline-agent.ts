import { resolveTemporal, zonedDate, type DeadlinePrecision } from "@/lib/sources/temporal";

export type DeadlineDecision = {
  dueAt: string | null;
  dueText: string | null;
  precision: DeadlinePrecision;
  confidence: number;
  askUser: boolean;
};

function localDay(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { year: read("year"), month: read("month"), day: read("day") };
}

export function runDeadlineAgent(input: {
  text: string;
  now?: Date;
  timeZone?: string;
}): DeadlineDecision {
  const timeZone = input.timeZone || "UTC";
  const temporal = resolveTemporal({ text: input.text, now: input.now, timeZone });
  const lower = input.text.toLowerCase();
  const openEnded = /\b(later|sometime|someday)\b/.test(lower) && !/\b(tonight|tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/.test(lower);
  if (!temporal || openEnded || !temporal.dueAt) {
    return {
      dueAt: null,
      dueText: temporal?.original ?? null,
      precision: "UNSPECIFIED",
      confidence: temporal?.confidence ?? 0,
      askUser: true,
    };
  }

  if (/\bevening\b/.test(lower) && temporal.precision === "DAY") {
    const day = localDay(temporal.dueAt, timeZone);
    const evening = zonedDate(timeZone, day.year, day.month, day.day, 18, 0);
    return {
      dueAt: evening.toISOString(),
      dueText: temporal.original.includes("evening") ? temporal.original : `${temporal.original} evening`,
      precision: "DAY_PART",
      confidence: Math.min(temporal.confidence, 0.78),
      askUser: false,
    };
  }

  return {
    dueAt: temporal.dueAt.toISOString(),
    dueText: temporal.original,
    precision: temporal.precision,
    confidence: temporal.confidence,
    askUser: temporal.askUser,
  };
}
