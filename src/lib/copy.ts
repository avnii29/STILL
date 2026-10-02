export const THREAD_STATUS_COPY: Record<string, string> = {
  DETECTED: "noticed",
  NEEDS_REVIEW: "waiting for you",
  OPEN: "still open",
  APPROACHING: "approaching",
  POSTPONED: "postponed",
  WAITING_ON_ME: "waiting on you",
  WAITING_ON_THEM: "waiting on them",
  CHANGED: "changed",
  LIKELY_RESOLVED: "might already be done",
  RESOLVED: "resolved",
  EXPIRED: "time passed",
  DISMISSED: "set aside",
};

export const COMMITMENT_TYPE_COPY: Record<string, string> = {
  EXPLICIT_PROMISE: "a promise",
  REQUEST: "a request",
  FUTURE_INTENTION: "an intention",
  RECIPROCAL_PLAN: "a shared plan",
  REMINDER_REQUEST: "a reminder you asked for",
  WAITING_STATE: "something you are waiting on",
  SELF_COMMITMENT: "something you told yourself",
};

export const OWNER_COPY: Record<string, string> = {
  ME: "you",
  THEM: "them",
  SHARED: "both of you",
  SELF: "you, to yourself",
};

export const NO_AUTO_MESSAGE =
  "STILL does not send messages to other people on your behalf. Any follow-up stays with you.";

const HANGING = [
  "DETECTED",
  "NEEDS_REVIEW",
  "OPEN",
  "APPROACHING",
  "POSTPONED",
  "WAITING_ON_ME",
  "WAITING_ON_THEM",
  "CHANGED",
] as const;
export const HANGING_STATUSES = HANGING;

export function greetingForHour(hour: number) {
  if (hour < 5) return "good night.";
  if (hour < 12) return "good morning.";
  if (hour < 17) return "good afternoon.";
  if (hour < 21) return "good evening.";
  return "good night.";
}

export function hangingCopy(count: number) {
  if (count === 0) return "nothing is hanging right now.";
  if (count === 1) return "1 thing is still hanging.";
  return `${count} things are still hanging.`;
}

export function sourceDisplayName(source?: string | null) {
  if (!source) return "";
  const names: Record<string, string> = {
    TELEGRAM: "Telegram",
    WHATSAPP: "WhatsApp",
    INSTAGRAM: "Instagram",
    EMAIL: "Email",
    VOICE: "Voice",
    TEXT: "Typed",
    MANUAL: "Manual",
    PASTE: "Pasted",
    CALENDAR: "Calendar",
    MEETINGS: "Meetings",
  };
  return names[source] ?? source.toLowerCase();
}

export function activityCopy(kind: string) {
  const map: Record<string, string> = {
    COMMITMENT_DETECTED: "STILL detected a possible commitment.",
    MEMORY_CREATED: "STILL remembered it.",
    SOURCE_INGESTED: "STILL received something you allowed.",
    REMEMBERED: "STILL remembered it.",
    AUTO_REMEMBERED: "STILL remembered something.",
    DETECTED: "STILL detected a possible commitment.",
    EVIDENCE_STORED: "STILL kept the evidence.",
    REMINDER_SCHEDULED: "STILL checked the deadline.",
    REMINDER_SENT: "STILL sent a reminder.",
    REMINDER_CREATED: "STILL checked the deadline.",
    LIKELY_RESOLVED: "STILL detected a possible resolution.",
    INTERVENTION_CREATED: "STILL checked before changing anything.",
  };
  return map[kind] ?? kind.replaceAll("_", " ").toLowerCase();
}

export function formatQuietDate(date: Date | string | null | undefined) {
  if (!date) return null;
  const value = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(value);
}

export function formatQuietDateLong(date: Date | string | null | undefined) {
  if (!date) return null;
  const value = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en", {
    month: "long",
    day: "numeric",
  }).format(value);
}

export function quietAgo(date: Date | string, now = new Date()) {
  const value = typeof date === "string" ? new Date(date) : date;
  const days = Math.round((now.getTime() - value.getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  const weeks = Math.round(days / 7);
  if (weeks === 1) return "1 week ago";
  if (days < 60) return `${weeks} weeks ago`;
  return formatQuietDateLong(value) ?? "";
}

export function hourInTimezone(timeZone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "numeric",
    hourCycle: "h23",
    timeZone,
  }).formatToParts(now);
  return Number(parts.find((part) => part.type === "hour")?.value ?? now.getHours());
}
