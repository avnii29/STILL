import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { clientIp, handleRouteError, jsonError } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { recordConsent } from "@/lib/consent";
import { startProviderConnect } from "@/lib/sources/accounts";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  provider: z.enum(["TELEGRAM", "WHATSAPP", "INSTAGRAM", "EMAIL", "CALENDAR", "MEETINGS"]),
});

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const limited = rateLimit(`integrations:${user.id}`, 20, 10 * 60 * 1000);
    if (!limited.allowed) {
      return jsonError(429, "Give STILL a moment.", { retryAfterMs: limited.retryAfterMs });
    }
    const body = bodySchema.parse(await request.json());
    const result = await startProviderConnect({
      userId: user.id,
      provider: body.provider,
      ip: clientIp(request),
    });
    if (!result.ok) {
      return NextResponse.json(result, { status: 409 });
    }
    await recordConsent({
      userId: user.id,
      purpose: `connect:${body.provider}`,
      source: body.provider,
      ip: clientIp(request),
      metadata: { provider: body.provider },
    });
    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error, "integrations.connect");
  }
}
