import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { logger } from "@/lib/logger";
import { payloadHash } from "@/lib/ingestion/normalizer";
import { getPrisma } from "@/lib/prisma";

const TERMINAL = new Set(["PROCESSED", "THREAD_UPDATED", "FAILED", "SKIPPED"]);

function isUnique(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function beginIngestion(input: {
  userId: string;
  connectorId: string;
  provider: string;
  externalEventId: string;
  eventType: string;
  occurredAt: Date;
  payload: string;
  route?: string | null;
  summary?: string | null;
}) {
  const prisma = getPrisma();
  try {
    const created = await prisma.ingestionEvent.create({
      data: {
        userId: input.userId,
        connectorId: input.connectorId,
        provider: input.provider,
        externalEventId: input.externalEventId,
        eventType: input.eventType,
        payloadHash: payloadHash(input.payload),
        occurredAt: input.occurredAt,
        processingStatus: "QUEUED",
        route: input.route ?? null,
        summary: input.summary ?? null,
      },
    });
    await prisma.ingestionEvent.update({
      where: { id: created.id },
      data: { processingStatus: "PROCESSING" },
    });
    return { id: created.id, duplicate: false as const };
  } catch (error) {
    if (!isUnique(error)) {
      logger.warn("ingestion.record_failed", {
        message: error instanceof Error ? error.message : "failed",
      });
      return null;
    }
    const existing = await prisma.ingestionEvent.findUnique({
      where: {
        connectorId_externalEventId: {
          connectorId: input.connectorId,
          externalEventId: input.externalEventId,
        },
      },
    });
    if (!existing) return null;
    return { id: existing.id, duplicate: true as const };
  }
}

export async function markIngestion(
  id: string,
  status: string,
  extra?: { route?: string | null; summary?: string | null; error?: string | null },
) {
  const prisma = getPrisma();
  await prisma.ingestionEvent.update({
    where: { id },
    data: {
      processingStatus: status,
      processedAt: TERMINAL.has(status) ? new Date() : null,
      route: extra?.route,
      summary: extra?.summary,
      error: extra?.error ?? null,
    },
  });
}
