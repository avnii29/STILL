import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { writeAuditLog } from "@/lib/audit";
import type { AppUser } from "@/lib/auth";
import { scheduleRemindAt } from "@/lib/agents/extract";
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

function dayLabel(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone }).format(date);
}

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

  const open = await prisma.thread.findMany({
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
  const only = open.filter((thread) => thread.dueAt);
  const chosen =
    ranked?.certainty === "STRONG"
      ? open.find((thread) => thread.id === ranked.thread.id) ?? null
      : only.length === 1
        ? only[0]
        : null;
  if (!chosen) {
    return { changed: false, threadId: ranked?.thread.id ?? null, reply: null };
  }

  const previous = chosen.dueAt;
  const from = previous ? dayLabel(previous, input.user.timezone) : "unspecified";
  const to = dayLabel(temporal.dueAt, input.user.timezone);
  const quote = input.content.replace(/\s+/g, " ").trim().slice(0, 280);
  await prisma.reminder.updateMany({
    where: { threadId: chosen.id, status: "SCHEDULED" },
    data: { status: "CANCELLED" },
  });
  await prisma.intervention.updateMany({
    where: { threadId: chosen.id, status: "PENDING" },
    data: { status: "CANCELLED" },
  });
  await prisma.reminder.create({
    data: {
      userId: input.user.id,
      threadId: chosen.id,
      remindAt: scheduleRemindAt(temporal.dueAt, input.now),
      channel: "IN_APP",
      body: `You said you'd ${chosen.title}. The time moved.`,
    },
  });
  await prisma.commitment.updateMany({
    where: { threadId: chosen.id },
    data: { dueAt: temporal.dueAt, dueHint: to },
  });
  await prisma.thread.update({
    where: { id: chosen.id },
    data: {
      dueAt: temporal.dueAt,
      suggestedFollowUpAt: temporal.dueAt,
      status: "CHANGED",
      currentState: `${from} → ${to}`,
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
      text: `Deadline changed.\n${from} → ${to}`,
      buttons: [{ label: "Open thread", data: `open:${chosen.id}` }],
    },
  };
}
