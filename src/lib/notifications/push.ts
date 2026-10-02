import "server-only";

import webpush from "web-push";
import { getServerEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getPrisma } from "@/lib/prisma";

function configure() {
  const env = getServerEnv();
  if (!env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return false;
  webpush.setVapidDetails(
    env.VAPID_SUBJECT ?? "mailto:still@localhost",
    env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    env.VAPID_PRIVATE_KEY,
  );
  return true;
}

export async function sendWebPush(input: {
  userId: string;
  title: string;
  body: string;
  href?: string;
}) {
  if (!configure()) return;

  const prisma = getPrisma();
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId: input.userId },
  });

  const payload = JSON.stringify({
    title: input.title,
    body: input.body,
    url: input.href ?? "/app",
  });

  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        payload,
      );
      await prisma.notification.create({
        data: {
          userId: input.userId,
          channel: "WEB_PUSH",
          status: "SENT",
          title: input.title,
          body: input.body,
          href: input.href,
          sentAt: new Date(),
        },
      });
    } catch (error) {
      logger.warn("push.failed", {
        endpoint: subscription.endpoint.slice(0, 48),
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }
}
