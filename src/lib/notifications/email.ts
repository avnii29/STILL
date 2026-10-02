import "server-only";

import { getServerEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

export async function sendEmail(input: { to: string; subject: string; text: string }) {
  const env = getServerEnv();
  if (env.EMAIL_PROVIDER === "none") {
    return { ok: false as const, skipped: true };
  }

  if (env.EMAIL_PROVIDER === "log") {
    logger.info("email.log", { to: input.to, subject: input.subject });
    return { ok: true as const, skipped: false };
  }

  const from = env.EMAIL_FROM ?? "Still <still@localhost>";

  if (env.EMAIL_PROVIDER === "resend") {
    if (!env.RESEND_API_KEY) {
      logger.warn("email.resend.missing_key");
      return { ok: false as const, skipped: true };
    }
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: input.to,
        subject: input.subject,
        text: input.text,
      }),
    });
    if (!response.ok) {
      logger.error("email.resend.failed", { status: response.status });
      return { ok: false as const, skipped: false };
    }
    return { ok: true as const, skipped: false };
  }

  if (env.EMAIL_PROVIDER === "smtp") {
    if (!env.SMTP_HOST) {
      logger.warn("email.smtp.missing_host");
      return { ok: false as const, skipped: true };
    }
    logger.warn("email.smtp.use_resend", {
      hint: "SMTP is reserved. Set EMAIL_PROVIDER=resend with RESEND_API_KEY, or EMAIL_PROVIDER=log.",
      host: env.SMTP_HOST,
    });
    return { ok: false as const, skipped: true };
  }

  logger.warn("email.provider.unknown", { provider: env.EMAIL_PROVIDER });
  return { ok: false as const, skipped: true };
}
