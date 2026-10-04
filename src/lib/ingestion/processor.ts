import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { createNotification } from "@/lib/notifications/dispatch";
import { overlapsCommitment, proposedCalendarShift } from "@/lib/ingestion/normalizer";
import { shouldInterrupt } from "@/lib/ingestion/router";
import { getPrisma } from "@/lib/prisma";

const OPEN = [
  "DETECTED",
  "NEEDS_REVIEW",
  "OPEN",
  "WAITING_ON_ME",
  "WAITING_ON_THEM",
  "APPROACHING",
  "POSTPONED",
  "CHANGED",
] as const;

export async function applyCalendarUpdate(input: {
  userId: string;
  accountId: string;
  calendarId: string;
  eventId: string;
  title: string;
  status: string;
  startsAt: Date | null;
  endsAt: Date | null;
  timeZone: string | null;
  htmlLink: string | null;
  updatedRemote: string | null;
}) {
  const prisma = getPrisma();
  const previous = await prisma.calendarEvent.findUnique({
    where: { accountId_externalId: { accountId: input.accountId, externalId: input.eventId } },
  });
  const saved = await prisma.calendarEvent.upsert({
    where: { accountId_externalId: { accountId: input.accountId, externalId: input.eventId } },
    create: {
      userId: input.userId,
      accountId: input.accountId,
      calendarId: input.calendarId,
      externalId: input.eventId,
      title: input.title,
      status: input.status,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      timeZone: input.timeZone,
      htmlLink: input.htmlLink,
      updatedRemote: input.updatedRemote,
    },
    update: {
      title: input.title,
      status: input.status,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      timeZone: input.timeZone,
      htmlLink: input.htmlLink,
      updatedRemote: input.updatedRemote,
      calendarId: input.calendarId,
    },
  });

  const threads = await prisma.thread.findMany({
    where: { userId: input.userId, status: { in: [...OPEN] }, dueAt: { not: null } },
    take: 30,
  });
  let conflicts = 0;
  const moved =
    previous?.startsAt &&
    input.startsAt &&
    previous.startsAt.getTime() !== input.startsAt.getTime();
  const cancelled = input.status === "cancelled";

  for (const thread of threads) {
    if (!thread.dueAt || !input.startsAt || !input.endsAt) continue;
    const hits = overlapsCommitment({
      dueAt: thread.dueAt,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
    });
    if (cancelled || moved) {
      const decision = shouldInterrupt("context_update");
      await prisma.threadEvent.create({
        data: {
          userId: input.userId,
          threadId: thread.id,
          kind: cancelled ? "CALENDAR_CANCELLED" : "CALENDAR_MOVED",
          body: cancelled
            ? `${input.title} was cancelled.\n${decision.reason}`
            : `${input.title} moved.\n${decision.reason}`,
          metadata: { eventId: input.eventId, calendarId: input.calendarId } as Prisma.InputJsonValue,
        },
      });
    }
    if (!hits || cancelled) continue;
    const existing = await prisma.actionProposal.findFirst({
      where: {
        userId: input.userId,
        threadId: thread.id,
        status: "PENDING",
        kind: "MOVE_CALENDAR_EVENT",
      },
    });
    if (existing) continue;
    const shift = proposedCalendarShift({
      dueAt: thread.dueAt,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
    });
    await prisma.actionProposal.create({
      data: {
        userId: input.userId,
        threadId: thread.id,
        kind: "MOVE_CALENDAR_EVENT",
        target: input.title,
        reason: `${input.title} overlaps ${thread.title}. STILL can move the calendar event after you approve.`,
        risk: "medium",
        requiresApproval: true,
        metadata: {
          calendarId: input.calendarId,
          eventId: input.eventId,
          start: shift.start.toISOString(),
          end: shift.end.toISOString(),
        } as Prisma.InputJsonValue,
      },
    });
    await createNotification({
      userId: input.userId,
      title: "Calendar overlap",
      body: `${input.title} overlaps ${thread.title}. Approval is required before anything moves.`,
      href: `/threads/${thread.id}`,
      topic: "blocked",
    });
    await writeAuditLog({
      userId: input.userId,
      action: "ACTION_PROPOSED",
      target: thread.id,
      metadata: { eventId: input.eventId },
    });
    conflicts += 1;
  }

  return { savedId: saved.id, conflicts, changed: Boolean(moved || cancelled || !previous) };
}
