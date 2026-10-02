import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { operator } from "@/config/operator";
import { getPrisma } from "@/lib/prisma";

export async function recordConsent(input: {
  userId: string;
  purpose: string;
  source: string;
  metadata?: Prisma.InputJsonValue;
  ip?: string;
}) {
  const prisma = getPrisma();
  const event = await prisma.consentEvent.create({
    data: {
      userId: input.userId,
      purpose: input.purpose,
      source: input.source,
      policyVersion: operator.policyVersion,
      metadata: input.metadata,
    },
  });
  await writeAuditLog({
    userId: input.userId,
    action: "CONSENT_GRANTED",
    target: event.id,
    metadata: { purpose: input.purpose, source: input.source },
    ip: input.ip,
  });
  return event;
}

export async function withdrawConsent(input: {
  userId: string;
  purpose: string;
  source?: string;
  ip?: string;
}) {
  const prisma = getPrisma();
  const open = await prisma.consentEvent.findMany({
    where: {
      userId: input.userId,
      purpose: input.purpose,
      withdrawnAt: null,
      ...(input.source ? { source: input.source } : {}),
    },
  });
  if (open.length === 0) return 0;
  await prisma.consentEvent.updateMany({
    where: { id: { in: open.map((item) => item.id) } },
    data: { withdrawnAt: new Date() },
  });
  await writeAuditLog({
    userId: input.userId,
    action: "CONSENT_WITHDRAWN",
    target: input.purpose,
    metadata: { source: input.source ?? null, count: open.length },
    ip: input.ip,
  });
  return open.length;
}
