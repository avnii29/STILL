import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { clientIp, handleRouteError, jsonError } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { withdrawConsent } from "@/lib/consent";
import { disconnectProvider } from "@/lib/sources/accounts";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  provider: z.enum(["TELEGRAM", "WHATSAPP", "INSTAGRAM", "EMAIL", "CALENDAR", "MEETINGS"]),
});

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const limited = rateLimit(`integrations-off:${user.id}`, 20, 10 * 60 * 1000);
    if (!limited.allowed) {
      return jsonError(429, "Give STILL a moment.", { retryAfterMs: limited.retryAfterMs });
    }
    const body = bodySchema.parse(await request.json());
    await disconnectProvider({
      userId: user.id,
      provider: body.provider,
      ip: clientIp(request),
    });
    await withdrawConsent({
      userId: user.id,
      purpose: `connect:${body.provider}`,
      source: body.provider,
      ip: clientIp(request),
    });
    return NextResponse.json({
      ok: true,
      status: "DISCONNECTED",
      message: "This source is disconnected. Existing memories stay unless you delete them.",
    });
  } catch (error) {
    return handleRouteError(error, "integrations.disconnect");
  }
}
