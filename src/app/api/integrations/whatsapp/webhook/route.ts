import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";
import { handleRouteError, jsonError, clientIp } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { getPrisma } from "@/lib/prisma";
import { processNormalizedMessage, claimProviderEvent, markProviderEventProcessed } from "@/lib/sources/pipeline";
import { verifyWhatsAppSignature, WhatsAppAdapter } from "@/lib/sources/whatsapp";
import { whatsappCapability } from "@/lib/sources/capabilities";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const env = getServerEnv();
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token && env.WHATSAPP_VERIFY_TOKEN && token === env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return jsonError(403, "WhatsApp verification failed.");
}

export async function POST(request: Request) {
  try {
    const limited = rateLimit(`whatsapp-webhook:${clientIp(request) ?? "anon"}`, 60, 60 * 1000);
    if (!limited.allowed) {
      return jsonError(429, "Too many provider events.", { retryAfterMs: limited.retryAfterMs });
    }

    const capability = whatsappCapability();
    if (!capability.connectable) {
      return jsonError(409, "STILL can't access this source yet.");
    }

    const raw = await request.text();
    if (!verifyWhatsAppSignature(raw, request.headers.get("x-hub-signature-256"))) {
      return jsonError(401, "Invalid WhatsApp webhook.");
    }

    const payload = JSON.parse(raw) as {
      entry?: Array<{
        changes?: Array<{
          value?: {
            messages?: Array<Record<string, unknown>>;
            metadata?: { phone_number_id?: string };
          };
        }>;
      }>;
    };

    const prisma = getPrisma();
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const phoneId = change.value?.metadata?.phone_number_id;
        const account = phoneId
          ? await prisma.integrationAccount.findFirst({
              where: {
                provider: "WHATSAPP",
                status: "CONNECTED",
                externalAccountId: phoneId,
              },
            })
          : null;
        for (const item of change.value?.messages ?? []) {
          const id = typeof item.id === "string" ? item.id : null;
          if (!id) continue;
          const claimed = await claimProviderEvent({
            provider: "WHATSAPP",
            externalEventId: id,
            kind: "message",
            userId: account?.userId,
            accountId: account?.id,
          });
          if (claimed.duplicate) continue;
          if (!account) {
            await markProviderEventProcessed(claimed.event.id);
            continue;
          }
          const normalized = WhatsAppAdapter.normalizeMessage(item, account.userId);
          if (normalized) {
            await processNormalizedMessage(normalized, { accountId: account.id });
          }
          await markProviderEventProcessed(claimed.event.id);
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error, "whatsapp.webhook");
  }
}
