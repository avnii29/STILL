import "server-only";

import { captchaMode, getServerEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { authFailureMessage, captchaRequirement } from "@/lib/auth/policy";

export async function verifyTurnstile(token: string | undefined, ip?: string) {
  const requirement = captchaRequirement({ mode: captchaMode(), token });
  if (requirement === "skip") return { ok: true as const };
  if (requirement === "unavailable") {
    return { ok: false as const, message: authFailureMessage("unavailable") };
  }
  if (requirement === "required") {
    return { ok: false as const, message: authFailureMessage("captcha") };
  }

  const secret = getServerEnv().TURNSTILE_SECRET_KEY;
  if (!secret) {
    return { ok: false as const, message: authFailureMessage("unavailable") };
  }

  try {
    const body = new URLSearchParams({ secret, response: token ?? "" });
    if (ip) body.set("remoteip", ip);
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!response.ok) {
      logger.warn("auth.turnstile.http", { status: response.status });
      return { ok: false as const, message: authFailureMessage("captcha") };
    }
    const payload = (await response.json()) as { success?: boolean; "error-codes"?: string[] };
    if (!payload.success) {
      logger.warn("auth.turnstile.rejected", { codes: payload["error-codes"] ?? [] });
      return { ok: false as const, message: authFailureMessage("captcha") };
    }
    return { ok: true as const };
  } catch (error) {
    logger.warn("auth.turnstile.failed", { error: error instanceof Error ? error.message : "unknown" });
    return { ok: false as const, message: authFailureMessage("captcha") };
  }
}
