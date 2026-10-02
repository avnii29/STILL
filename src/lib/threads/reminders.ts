import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { hoursUntil } from "@/lib/agents/extract";
import { getPrisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { createNotification } from "@/lib/notifications/dispatch";
import { evaluateIntervention } from "@/lib/threads/lifecycle";
import { calendarStatus } from "@/lib/integrations/google";

export async function processDueReminders(now = new Date()) {
  const prisma = getPrisma();
  const due = await prisma.reminder.findMany({
    where: {
      status: "SCHEDULED",
      remindAt: { lte: now },
    },
    include: {
      thread: {
        select: {
          id: true,
          title: true,
          dueAt: true,
          evidence: true,
          postponementCount: true,
          status: true,
          userId: true,
        },
      },
    },
    take: 50,
  });

  let sent = 0;
  for (const reminder of due) {
    if (
      reminder.thread.status === "RESOLVED" ||
      reminder.thread.status === "DISMISSED" ||
      reminder.thread.status === "EXPIRED"
    ) {
      await prisma.reminder.update({
        where: { id: reminder.id },
        data: { status: "CANCELLED" },
      });
      continue;
    }

    const hours = reminder.thread.dueAt ? Math.max(0, Math.round(hoursUntil(reminder.thread.dueAt, now))) : null;
    const body =
      hours === null
        ? reminder.body
        : hours <= 2
          ? `You said you'd ${reminder.thread.title}. A little time left.`
          : `You said you'd ${reminder.thread.title}. ${hours} hours left.`;

    await createNotification({
      userId: reminder.userId,
      title: "STILL",
      body,
      href: `/threads/${reminder.thread.id}`,
    });

    await prisma.reminder.update({
      where: { id: reminder.id },
      data: { status: "SENT", deliveredAt: now },
    });
    await prisma.threadEvent.create({
      data: {
        userId: reminder.userId,
        threadId: reminder.thread.id,
        kind: "REMINDER_SENT",
        body,
      },
    });
    await prisma.thread.update({
      where: { id: reminder.thread.id },
      data: { status: "APPROACHING" },
    });

    const calendar = calendarStatus(false);
    const intervention = evaluateIntervention({
      dueAt: reminder.thread.dueAt,
      postponementCount: reminder.thread.postponementCount,
      calendarConnected: calendar.connected,
      hasConflict: false,
      latestEvidence: reminder.thread.evidence,
      now,
    });
    if (intervention.intervene) {
      await prisma.intervention.create({
        data: {
          userId: reminder.userId,
          threadId: reminder.thread.id,
          reason: intervention.reason,
          suggestedAction: intervention.suggestedAction,
          confidence: intervention.confidence,
          requiresApproval: true,
          metadata: { calendar: calendar.message } as Prisma.InputJsonValue,
        },
      });
      await prisma.threadEvent.create({
        data: {
          userId: reminder.userId,
          threadId: reminder.thread.id,
          kind: "INTERVENTION_PROPOSED",
          body: intervention.suggestedAction,
        },
      });
    }

    await writeAuditLog({
      userId: reminder.userId,
      action: "REMINDER_SENT",
      target: reminder.id,
    });
    sent += 1;
  }

  logger.info("reminders.processed", { due: due.length, sent });
  return { due: due.length, sent };
}
