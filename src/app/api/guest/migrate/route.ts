import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { recordConsent } from "@/lib/consent";
import { isDatabaseConfigured } from "@/lib/env";
import { handleRouteError, jsonError, clientIp } from "@/lib/http";
import { getPrisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { rememberNote } from "@/lib/threads/ingest";
import { guestMigrateSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    if (!isDatabaseConfigured()) {
      return jsonError(503, "STILL cannot keep these yet. The database is not connected.");
    }
    const limited = rateLimit(`guest-migrate:${user.id}`, 6, 10 * 60 * 1000);
    if (!limited.allowed) {
      return jsonError(429, "Give STILL a moment.", { retryAfterMs: limited.retryAfterMs });
    }

    const body = guestMigrateSchema.parse(await request.json());
    const prisma = getPrisma();
    const threadIds: string[] = [];
    const ip = clientIp(request);

    for (const item of body.threads) {
      const existing = await prisma.thread.findFirst({
        where: {
          userId: user.id,
          evidence: { equals: item.note, mode: "insensitive" },
        },
      });
      if (existing) {
        threadIds.push(existing.id);
        continue;
      }
      const result = await rememberNote({
        user,
        note: item.note,
        personName: item.personName,
        isSelf: !item.personName,
        ip,
        sourceKind: item.sourceKind ?? "TEXT",
        quiet: true,
      });
      threadIds.push(...result.threadIds);
    }

    await prisma.profile.update({
      where: { userId: user.id },
      data: {
        onboardingCompletedAt: user.onboardingCompletedAt ?? new Date(),
        ...(body.timezone ? { timezone: body.timezone } : {}),
      },
    });

    await recordConsent({
      userId: user.id,
      purpose: "keep_guest_memories",
      source: "guest_workspace",
      metadata: { migrated: threadIds.length },
      ip,
    });

    return NextResponse.json({
      ok: true,
      threadIds,
      migrated: threadIds.length,
    });
  } catch (error) {
    return handleRouteError(error, "guest.migrate");
  }
}
