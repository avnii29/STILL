import { NextResponse } from "next/server";
import { extractCommitment } from "@/lib/agents/extract";
import { getServerEnv } from "@/lib/env";
import { handleRouteError, jsonError, clientIp } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { extractPayloadSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const ip = clientIp(request) ?? "unknown";
    const dailyLimit = Number(getServerEnv().GUEST_EXTRACT_DAILY_LIMIT ?? 24);
    const daily = rateLimit(`extract-day:${ip}`, Number.isFinite(dailyLimit) ? dailyLimit : 24, 24 * 60 * 60 * 1000);
    if (!daily.allowed) {
      return jsonError(429, "You've reached today's guest processing limit. Your existing threads are still here.", {
        retryAfterMs: daily.retryAfterMs,
        limit: "daily",
      });
    }
    const burst = rateLimit(`extract:${ip}`, 20, 10 * 60 * 1000);
    if (!burst.allowed) {
      return jsonError(429, "Give STILL a moment.", { retryAfterMs: burst.retryAfterMs, limit: "burst" });
    }
    const body = extractPayloadSchema.parse(await request.json());
    const extraction = extractCommitment({
      text: body.note,
      personHint: body.personName,
    });
    return NextResponse.json({
      extraction,
      persisted: false,
      remaining: daily.remaining,
    });
  } catch (error) {
    return handleRouteError(error, "extract");
  }
}
