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
}) {
  const prisma = getPrisma();
  const preference = await prisma.userPreference.findUnique({
    where: { userId: input.userId },
  });

  const inApp = await prisma.notification.create({
    data: {
      userId: input.userId,
      channel: "IN_APP",
      status: "SENT",
      title: input.title,
      body: input.body,
      href: input.href,
      sentAt: new Date(),
    },
  });

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

  logger.info("notification.created", { userId: input.userId, id: inApp.id });
  return inApp;
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
