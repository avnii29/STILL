import { NextResponse } from "next/server";
import { handleRouteError, jsonError, clientIp } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { getPrisma } from "@/lib/prisma";
import { instagramCapability } from "@/lib/sources/capabilities";
import { InstagramAdapter, verifyInstagramSignature } from "@/lib/sources/instagram";
import { claimProviderEvent, markProviderEventProcessed, processNormalizedMessage } from "@/lib/sources/pipeline";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const limited = rateLimit(`instagram-webhook:${clientIp(request) ?? "anon"}`, 60, 60 * 1000);
    if (!limited.allowed) {
      return jsonError(429, "Too many provider events.", { retryAfterMs: limited.retryAfterMs });
    }

    const capability = instagramCapability();
    if (!capability.connectable) {
      return jsonError(409, "Instagram messaging isn't available for your account through the supported connection.");
    }

    const raw = await request.text();
    if (!verifyInstagramSignature(raw, request.headers.get("x-hub-signature-256"))) {
      return jsonError(401, "Invalid Instagram webhook.");
    }

    const payload = JSON.parse(raw) as {
      entry?: Array<{ messaging?: Array<{ message?: Record<string, unknown>; sender?: { id?: string } }> }>;
    };
    const prisma = getPrisma();
    const events = payload.entry?.flatMap((entry) => entry.messaging ?? []) ?? [];

    for (const event of events) {
      const rawMessage = event.message ?? {};
      const message = { ...rawMessage, from: event.sender };
      const id =
        (typeof (rawMessage as { mid?: string }).mid === "string" &&
          (rawMessage as { mid?: string }).mid) ||
        (typeof (rawMessage as { id?: string }).id === "string" &&
          (rawMessage as { id?: string }).id) ||
        null;
      if (!id) continue;
      const claimed = await claimProviderEvent({
        provider: "INSTAGRAM",
        externalEventId: id,
        kind: "message",
      });
      if (claimed.duplicate) continue;
      const igUser = event.sender?.id;
      const account = igUser
        ? await prisma.integrationAccount.findFirst({
            where: {
              provider: "INSTAGRAM",
              status: "CONNECTED",
              externalAccountId: igUser,
            },
          })
        : null;
      if (!account) {
        await markProviderEventProcessed(claimed.event.id);
        continue;
      }
      const normalized = InstagramAdapter.normalizeMessage(message, account.userId);
      if (normalized) {
        await processNormalizedMessage(normalized, { accountId: account.id });
      }
      await markProviderEventProcessed(claimed.event.id);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error, "instagram.webhook");
  }
}
