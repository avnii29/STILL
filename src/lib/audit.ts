import "server-only";

import type { AuditAction, Prisma } from "@/generated/prisma/client";
import { isDatabaseConfigured } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getPrisma } from "@/lib/prisma";

export async function writeAuditLog(input: {
  userId?: string | null;
  action: AuditAction;
  target?: string;
  metadata?: Prisma.InputJsonValue;
  ip?: string;
}) {
  if (!isDatabaseConfigured()) return;
  try {
    const prisma = getPrisma();
    await prisma.auditLog.create({
      data: {
        userId: input.userId ?? null,
        action: input.action,
        target: input.target,
        metadata: input.metadata,
        ip: input.ip,
      },
    });
  } catch (error) {
    logger.error("audit.write.failed", {
      action: input.action,
      error: error instanceof Error ? error.message : "unknown",
    });
  }
}
