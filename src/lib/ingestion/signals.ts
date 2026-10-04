import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { writeAuditLog } from "@/lib/audit";
import type { AppUser } from "@/lib/auth";
import { scheduleRemindAt } from "@/lib/agents/extract";
import { zonedDate } from "@/lib/sources/temporal";
import { createNotification } from "@/lib/notifications/dispatch";
import { getPrisma } from "@/lib/prisma";
import { bestThreadMatch } from "@/lib/sources/thread-match";
import { resolveTemporal } from "@/lib/sources/temporal";
import type { CommitmentDetection } from "@/lib/sources/detect";

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

function detectionFrom(content: string, person: string | null, dueAt: Date | null): CommitmentDetection {
  return {
    classification: "COMMITMENT",
    confidence: 0.8,
    commitment_text: content,
    normalized_commitment: content,
    actor: "ME",
    target_person: person,
    deadline: dueAt ? dueAt.toISOString() : null,
    deadline_confidence: dueAt ? 0.7 : 0,
    due_at: dueAt ? dueAt.toISOString() : null,
    deadline_precision: dueAt ? "DAY" : null,
    evidence_span: content.slice(0, 280),
    reasoning_summary: "Deadline language in an authorized message.",
    ask_when: false,
    when_prompt: null,
  };
}

export async function applyDeadlineChange(input: {
  user: AppUser;
  content: string;
  provider: string;
  now?: Date;
  threadId?: string;
  nextStatus?: "NEEDS_REVIEW" | "OPEN" | "CHANGED";
}) {
  const prisma = getPrisma();
  const preference = await prisma.userPreference.findUnique({ where: { userId: input.user.id } });
  if (preference && !preference.rememberDeadlines) {
    return { changed: false, threadId: null as string | null, reply: null };
  }
  const temporal = resolveTemporal({
    text: input.content,
    now: input.now,
    timeZone: input.user.timezone,
  });
  if (!temporal?.dueAt) {
    return { changed: false, threadId: null as string | null, reply: null };
  }
  const relaxed = relaxNoRush(input.content, temporal.dueAt, temporal.precision, input.user.timezone);
  temporal.dueAt = relaxed;

  const open = input.threadId
    ? await prisma.thread.findMany({
        where: { id: input.threadId, userId: input.user.id, status: { in: [...OPEN] } },
        include: { person: true },
      })
    : await prisma.thread.findMany({
        where: { userId: input.user.id, status: { in: [...OPEN] } },
        include: { person: true },
        take: 20,
        orderBy: { updatedAt: "desc" },
      });
  const detection = detectionFrom(input.content, null, temporal.dueAt);
  const ranked = bestThreadMatch(
    open.map((thread) => ({
      id: thread.id,
      title: thread.title,
      evidence: thread.evidence,
      personName: thread.person?.name,
    })),
    detection,
  );
  const targeted = input.threadId ? open.find((thread) => thread.id === input.threadId) ?? null : null;
  const only = open.filter((thread) => thread.dueAt);
  const chosen =
    targeted ??
    (ranked?.certainty === "STRONG"
      ? open.find((thread) => thread.id === ranked.thread.id) ?? null
      : only.length === 1
        ? only[0]
        : null);
  if (!chosen) {
    return { changed: false, threadId: ranked?.thread.id ?? null, reply: null };
  }

  const previous = chosen.dueAt;
  if (previous && Math.abs(previous.getTime() - temporal.dueAt.getTime()) < 60_000) {
    return { changed: false, threadId: chosen.id, reply: null };
  }
  const from = previous ? whenLabel(previous, input.user.timezone) : "unspecified";
  const to = whenLabel(temporal.dueAt, input.user.timezone);
  const quote = input.content.replace(/\s+/g, " ").trim().slice(0, 280);
  const noRush = /\bno rush\b|\bno hurry\b/i.test(input.content);
  const remindAt = scheduleRemindAt(temporal.dueAt, input.now);
  const scheduled = await prisma.reminder.findFirst({
    where: { threadId: chosen.id, status: "SCHEDULED" },
    orderBy: { remindAt: "asc" },
  });
  if (scheduled) {
    await prisma.reminder.update({
      where: { id: scheduled.id },
      data: { remindAt, body: `You said you'd ${chosen.title}. The time moved.` },
    });
  } else {
    await prisma.reminder.create({
      data: {
        userId: input.user.id,
        threadId: chosen.id,
        remindAt,
        channel: "IN_APP",
        body: `You said you'd ${chosen.title}. The time moved.`,
      },
    });
  }
  await prisma.commitment.updateMany({
    where: { threadId: chosen.id },
    data: { dueAt: temporal.dueAt, dueHint: to },
  });
  await prisma.thread.update({
    where: { id: chosen.id },
    data: {
      dueAt: temporal.dueAt,
      suggestedFollowUpAt: temporal.dueAt,
      status: input.nextStatus ?? "CHANGED",
      currentState: noRush ? "You don't need to rush this anymore." : `${from} → ${to}`,
      events: {
        create: {
          userId: input.user.id,
          kind: "DEADLINE_CHANGED",
          body: `${from} → ${to}\n"${quote}"`,
          metadata: {
            provider: input.provider,
            from: previous?.toISOString() ?? null,
            to: temporal.dueAt.toISOString(),
          } as Prisma.InputJsonValue,
        },
      },
    },
  });
  await createNotification({
    userId: input.user.id,
    title: "Deadline changed",
    body: `${chosen.title}\n${from} → ${to}\n"${quote}"\nSource: ${input.provider}`,
    href: `/threads/${chosen.id}`,
    topic: "deadline_change",
  });
  await writeAuditLog({
    userId: input.user.id,
    action: "COMMITMENT_POSTPONED",
    target: chosen.id,
    metadata: { provider: input.provider, to: temporal.dueAt.toISOString() },
  });
  return {
    changed: true,
    threadId: chosen.id,
    reply: {
      text: noRush ? `You don't need to rush this anymore.\n${from} → ${to}` : `Deadline changed.\n${from} → ${to}`,
      buttons: [{ label: "Open thread", data: `open:${chosen.id}` }],
    },
  };
}

function whenLabel(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(date);
}

function relaxNoRush(content: string, dueAt: Date, precision: string, timeZone: string) {
  if (!/\bno rush\b|\bno hurry\b/i.test(content) || precision !== "DAY") return dueAt;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hourCycle: "h23",
  }).formatToParts(dueAt);
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return zonedDate(timeZone, read("year"), read("month"), read("day"), 21, 0);
}
