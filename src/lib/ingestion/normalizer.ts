import { createHash } from "node:crypto";
import type { InboundEvent } from "@/lib/ingestion/types";

export type CalendarItemInput = {
  id?: string;
  status?: string;
  summary?: string;
  description?: string;
  htmlLink?: string;
  updated?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
};

export function payloadHash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function calendarInstant(point?: { dateTime?: string; date?: string }) {
  if (!point) return null;
  if (point.dateTime) {
    const parsed = new Date(point.dateTime);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (point.date) {
    const parsed = new Date(`${point.date}T00:00:00.000Z`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

export function normalizeCalendarItem(input: {
  userId: string;
  calendarId: string;
  item: CalendarItemInput;
}): InboundEvent | null {
  const external = input.item.id?.trim();
  if (!external) return null;
  const start = calendarInstant(input.item.start);
  const end = calendarInstant(input.item.end);
  const occurredAt = input.item.updated ?? start?.toISOString() ?? new Date().toISOString();
  const title = input.item.summary?.trim() || "Calendar event";
  return {
    id: `${input.calendarId}:${external}:${input.item.updated ?? start?.toISOString() ?? input.item.status ?? "event"}`,
    userId: input.userId,
    provider: "CALENDAR",
    sourceType: "calendar_event",
    externalId: `${input.calendarId}:${external}:${input.item.updated ?? start?.toISOString() ?? input.item.status ?? "event"}`,
    occurredAt,
    actor: "calendar",
    content: title,
    metadata: {
      calendarId: input.calendarId,
      eventId: external,
      status: input.item.status ?? "confirmed",
      startsAt: start?.toISOString() ?? null,
      endsAt: end?.toISOString() ?? null,
      timeZone: input.item.start?.timeZone ?? input.item.end?.timeZone ?? null,
      htmlLink: input.item.htmlLink ?? null,
      updated: input.item.updated ?? null,
    },
  };
}

export function overlapsCommitment(input: { dueAt: Date; startsAt: Date; endsAt: Date }) {
  const due = input.dueAt.getTime();
  const start = input.startsAt.getTime();
  const end = input.endsAt.getTime();
  if (due >= start && due < end) return true;
  return Math.abs(due - start) <= 30 * 60 * 1000;
}

export function proposedCalendarShift(input: { dueAt: Date; startsAt: Date; endsAt: Date }) {
  const duration = Math.max(input.endsAt.getTime() - input.startsAt.getTime(), 30 * 60 * 1000);
  const start = new Date(input.dueAt.getTime() + 60 * 60 * 1000);
  const end = new Date(start.getTime() + duration);
  return { start, end };
}
