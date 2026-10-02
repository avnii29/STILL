export type DeadlinePrecision = "EXACT" | "DAY_PART" | "DAY" | "RANGE" | "UNSPECIFIED";

export type TemporalHit = {
  original: string;
  dueAt: Date | null;
  timeZone: string;
  confidence: number;
  precision: DeadlinePrecision;
  askUser: boolean;
  prompt: string | null;
};

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function offsetMinutesFor(date: Date, timeZone: string) {
  const name = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
    hour: "numeric",
  })
    .formatToParts(date)
    .find((part) => part.type === "timeZoneName")?.value;
  if (!name) return 0;
  const match = name.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!match) return 0;
  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3] ?? 0));
}

function wallParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  }).formatToParts(date);
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "";
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    weekday,
  };
}

export function zonedDate(
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute = 0,
) {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const offset = offsetMinutesFor(new Date(utcGuess), timeZone);
  return new Date(utcGuess - offset * 60_000);
}

function addDays(parts: ReturnType<typeof wallParts>, days: number) {
  const utc = Date.UTC(parts.year, parts.month - 1, parts.day + days, 12, 0, 0);
  const next = new Date(utc);
  return { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate() };
}

export function resolveTemporal(input: {
  text: string;
  now?: Date;
  timeZone?: string;
}): TemporalHit | null {
  const now = input.now ?? new Date();
  const timeZone = input.timeZone || "UTC";
  const lower = input.text.toLowerCase();
  const parts = wallParts(now, timeZone);
  const at = (days: number, hour: number, minute = 0, original: string, precision: DeadlinePrecision, confidence: number, askUser = false, prompt: string | null = null): TemporalHit => {
    const next = addDays(parts, days);
    return {
      original,
      dueAt: zonedDate(timeZone, next.year, next.month, next.day, hour, minute),
      timeZone,
      confidence,
      precision,
      askUser,
      prompt,
    };
  };

  if (/\bin two hours\b/.test(lower) || /\bin 2 hours\b/.test(lower)) {
    const due = new Date(now.getTime() + 2 * 3_600_000);
    return {
      original: "in two hours",
      dueAt: due,
      timeZone,
      confidence: 0.9,
      precision: "EXACT",
      askUser: false,
      prompt: null,
    };
  }
  if (/\btomorrow evening\b/.test(lower)) {
    return at(1, 18, 0, "tomorrow evening", "DAY_PART", 0.78, false, "Evening is approximate. You can edit the time.");
  }
  if (/\btomorrow night\b/.test(lower)) return at(1, 20, 0, "tomorrow night", "DAY_PART", 0.76);
  if (/\btomorrow morning\b/.test(lower)) return at(1, 9, 0, "tomorrow morning", "DAY_PART", 0.8);
  if (/\btomorrow afternoon\b/.test(lower)) return at(1, 14, 0, "tomorrow afternoon", "DAY_PART", 0.78);
  if (/\bthis evening\b/.test(lower)) return at(0, 18, 0, "this evening", "DAY_PART", 0.74);
  if (/\blater today\b/.test(lower)) {
    return at(0, Math.min(22, Math.max(parts.hour + 3, 18)), 0, "later today", "DAY_PART", 0.5, true, "When should I remind you?");
  }
  if (/\btomorrow at (\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/.test(lower)) {
    const match = lower.match(/\btomorrow at (\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/);
    let hour = Number(match?.[1] ?? 9);
    const minute = Number(match?.[2] ?? 0);
    const meridiem = match?.[3];
    if (meridiem === "pm" && hour < 12) hour += 12;
    if (meridiem === "am" && hour === 12) hour = 0;
    return at(1, hour, minute, match?.[0] ?? "tomorrow", "EXACT", 0.92);
  }
  if (/\btomorrow\b/.test(lower)) return at(1, 9, 0, "tomorrow", "DAY", 0.8);
  if (/\btonight\b/.test(lower)) return at(0, 20, 0, "tonight", "DAY_PART", 0.84);
  if (/\btoday\b/.test(lower)) return at(0, 18, 0, "today", "DAY", 0.72);
  if (/\bthis weekend\b/.test(lower)) {
    const current = now.getDay();
    const days = current <= 6 ? 6 - current : 6;
    return at(days || 6, 10, 0, "this weekend", "RANGE", 0.48, true, "Which part of the weekend?");
  }
  if (/\bnext week\b/.test(lower)) return at(7, 9, 0, "next week", "RANGE", 0.42, true, "Which day next week?");
  if (/\bafter lunch\b/.test(lower)) return at(0, 14, 0, "after lunch", "DAY_PART", 0.55, true, "When after lunch?");
  if (/\bbefore the meeting\b/.test(lower)) {
    return {
      original: "before the meeting",
      dueAt: null,
      timeZone,
      confidence: 0.3,
      precision: "UNSPECIFIED",
      askUser: true,
      prompt: "When is the meeting?",
    };
  }
  if (/\blater\b/.test(lower) && !/\blater today\b/.test(lower)) {
    return {
      original: "later",
      dueAt: null,
      timeZone,
      confidence: 0.35,
      precision: "UNSPECIFIED",
      askUser: true,
      prompt: "When should I remind you?",
    };
  }

  const nextFriday = lower.match(/\bnext (monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/);
  const weekday = nextFriday?.[1] ?? lower.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/)?.[1];
  if (weekday) {
    const target = WEEKDAYS.indexOf(weekday);
    const current = now.getDay();
    let days = (target - current + 7) % 7;
    if (days === 0 || nextFriday) days = days === 0 ? 7 : days;
    return at(days, 9, 0, nextFriday ? `next ${weekday}` : weekday, "DAY", 0.64);
  }

  return null;
}
