import "server-only";

import type { ThreadStatus } from "@/generated/prisma/client";
import { sourceLiveStatus } from "@/lib/connectors/status";
import type { LiveNow } from "@/lib/ingestion/types";
import { isGoogleCalendarConfigured } from "@/lib/integrations/google";
import { providerCatalog } from "@/lib/sources/capabilities";
import { getPrisma } from "@/lib/prisma";

const OPEN: ThreadStatus[] = [
  "DETECTED",
  "NEEDS_REVIEW",
  "OPEN",
  "WAITING_ON_ME",
  "WAITING_ON_THEM",
  "APPROACHING",
  "POSTPONED",
  "CHANGED",
  "LIKELY_RESOLVED",
];

export async function loadLiveNow(userId: string): Promise<LiveNow> {
  const prisma = getPrisma();
  const [accounts, events, checking, deadlines, waiting, analyzing] = await Promise.all([
    prisma.integrationAccount.findMany({ where: { userId } }),
    prisma.ingestionEvent.findMany({
      where: { userId },
      orderBy: { receivedAt: "desc" },
      take: 12,
    }),
    prisma.thread.count({ where: { userId, status: { in: OPEN } } }),
    prisma.thread.count({ where: { userId, status: { in: OPEN }, dueAt: { not: null } } }),
    prisma.actionProposal.count({ where: { userId, status: "PENDING" } }),
    prisma.ingestionEvent.count({ where: { userId, processingStatus: "PROCESSING" } }),
  ]);
  const catalog = providerCatalog();
  const listening = catalog
    .filter((provider) => provider.id !== "VOICE")
    .map((provider) => {
      const account = accounts.find((item) => item.provider === provider.id);
      const configured =
        provider.id === "CALENDAR" ? isGoogleCalendarConfigured() && provider.available : provider.available;
      return {
        provider: provider.title,
        live: sourceLiveStatus({
          provider: provider.id,
          configured,
          status: account?.status,
          hasToken: Boolean(account?.tokenCipher),
          metadata: account?.metadata,
        }),
      };
    });
  const liveCount = listening.filter((item) => item.live === "LIVE").length;
  const line =
    waiting > 0
      ? `${waiting} approval waiting.`
      : liveCount === 0
        ? "Nothing is live yet."
        : "Nothing else needs you.";
  return {
    listening,
    analyzing,
    checking,
    watchingDeadlines: deadlines,
    waiting,
    line,
    events: events.map((event) => ({
      id: event.id,
      at: event.receivedAt.toISOString(),
      provider: event.provider,
      summary: event.summary || event.processingStatus,
      status: event.processingStatus,
      route: event.route,
    })),
  };
}
