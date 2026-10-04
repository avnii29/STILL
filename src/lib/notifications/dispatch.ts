import "server-only";

import { getServerEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getPrisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/notifications/email";
import { sendWebPush } from "@/lib/notifications/push";

export async function createNotification(input: {
  userId: string;
  title: string;
  body: string;
  href?: string;
  topic?: "commitment" | "deadline" | "blocked" | "deadline_change" | "resolved" | "context";
}) {
  const prisma = getPrisma();
  const preference = await prisma.userPreference.findUnique({
    where: { userId: input.userId },
  });
  const allowed = topicAllowed(preference, input.topic);
  if (!allowed) return null;

  const profile = await prisma.profile.findUnique({ where: { userId: input.userId } });
  const quiet = inQuietHours(
    preference?.quietHoursStart ?? null,
    preference?.quietHoursEnd ?? null,
    new Date(),
    profile?.timezone || "UTC",
  );
  const inAppOn = preference?.notifyInApp !== false;

  const inApp = inAppOn
    ? await prisma.notification.create({
        data: {
          userId: input.userId,
          channel: "IN_APP",
          status: quiet ? "PENDING" : "SENT",
          title: input.title,
          body: input.body,
          href: input.href,
          sentAt: quiet ? null : new Date(),
        },
      })
    : null;

  if (quiet) return inApp;

  const user = await prisma.user.findUnique({ where: { id: input.userId } });

  if (preference?.emailNotifications && user?.email) {
    const emailResult = await sendEmail({
      to: user.email,
      subject: input.title,
      text: input.body,
    });
    await prisma.notification.create({
      data: {
        userId: input.userId,
        channel: "EMAIL",
        status: emailResult.ok ? "SENT" : "FAILED",
        title: input.title,
        body: input.body,
        href: input.href,
        sentAt: emailResult.ok ? new Date() : null,
      },
    });
  }

  if (preference?.webPushEnabled) {
    await sendWebPush({
      userId: input.userId,
      title: input.title,
      body: input.body,
      href: input.href,
    });
  }

  if (inApp) logger.info("notification.created", { userId: input.userId, id: inApp.id });
  return inApp;
}

function topicAllowed(
  preference: {
    notifyCommitment: boolean;
    notifyDeadline: boolean;
    notifyBlocked: boolean;
    notifyDeadlineChange: boolean;
    notifyResolved: boolean;
    notifyMinorContext: boolean;
  } | null,
  topic?: "commitment" | "deadline" | "blocked" | "deadline_change" | "resolved" | "context",
) {
  if (!topic || !preference) return true;
  if (topic === "commitment") return preference.notifyCommitment;
  if (topic === "deadline") return preference.notifyDeadline;
  if (topic === "blocked") return preference.notifyBlocked;
  if (topic === "deadline_change") return preference.notifyDeadlineChange;
  if (topic === "resolved") return preference.notifyResolved;
  return preference.notifyMinorContext;
}

function inQuietHours(start: string | null, end: string | null, now: Date, timeZone: string) {
  if (!start || !end || start === end) return false;
  const current = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(now);
  if (start < end) return current >= start && current < end;
  return current >= start || current < end;
}

export async function releaseQuietNotifications() {
  const prisma = getPrisma();
  const pending = await prisma.notification.findMany({
    where: { channel: "IN_APP", status: "PENDING" },
    take: 40,
    include: { user: { include: { profile: true, preference: true } } },
  });
  let released = 0;
  for (const note of pending) {
    const quiet = inQuietHours(
      note.user.preference?.quietHoursStart ?? null,
      note.user.preference?.quietHoursEnd ?? null,
      new Date(),
      note.user.profile?.timezone || "UTC",
    );
    if (quiet) continue;
    await prisma.notification.update({
      where: { id: note.id },
      data: { status: "SENT", sentAt: new Date() },
    });
    released += 1;
  }
  return { released };
}

export function nativePushReadyLater() {
  const env = getServerEnv();
  return {
    channel: "NATIVE_PUSH" as const,
    supported: false,
    note: "Native mobile push is architected via the Notification channel enum and dispatch layer. It is not wired to APNs or FCM yet.",
    vapidConfigured: Boolean(env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY),
  };
}
