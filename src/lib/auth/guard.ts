import "server-only";

import { NextResponse } from "next/server";
import { authFailureMessage } from "@/lib/auth/policy";
import { sameOrigin } from "@/lib/auth/request";
import { verifyTurnstile } from "@/lib/auth/turnstile";
import { isSupabaseConfigured } from "@/lib/env";
import { clientIp, jsonError } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

export async function prepareAuth(request: Request, bucket: string, token: string | undefined) {
  if (!sameOrigin(request)) {
    return { ok: false as const, response: jsonError(403, authFailureMessage("captcha")) };
  }
  const ip = clientIp(request) ?? "unknown";
  const limited = rateLimit(`auth:${bucket}:${ip}`, 8, 10 * 60 * 1000);
  if (!limited.allowed) {
    return { ok: false as const, response: jsonError(429, authFailureMessage("rate")) };
  }
  if (!isSupabaseConfigured()) {
    return {
      ok: false as const,
      response: jsonError(503, "STILL isn't connected to its account service yet."),
    };
  }
  const captcha = await verifyTurnstile(token, ip);
  if (!captcha.ok) {
    return { ok: false as const, response: jsonError(400, captcha.message) };
  }
  return { ok: true as const, ip };
}

export function authJson(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status });
}
