import { z } from "zod";
import { openAppAccess, recordSignIn } from "@/lib/auth";
import { recordConsent } from "@/lib/consent";
import { authJson, prepareAuth } from "@/lib/auth/guard";
import { authFailureMessage, emailError, maskEmail, normalizeEmail, passwordError, safeAuthNext } from "@/lib/auth/policy";
import { requestOrigin } from "@/lib/auth/request";
import { clientIp, handleRouteError, jsonError } from "@/lib/http";
import { logger } from "@/lib/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().max(320),
  password: z.string().min(1).max(200),
  captchaToken: z.string().max(2048).optional(),
  acceptedTerms: z.literal(true),
  timezone: z.string().max(64).optional(),
  next: z.string().max(300).optional(),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const emailIssue = emailError(body.email);
    const passwordIssue = passwordError(body.password, "new");
    if (emailIssue || passwordIssue) {
      return jsonError(400, emailIssue ?? passwordIssue ?? authFailureMessage("generic"));
    }
    const ready = await prepareAuth(request, "sign-up", body.captchaToken);
    if (!ready.ok) return ready.response;

    const email = normalizeEmail(body.email);
    const next = safeAuthNext(body.next);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password: body.password,
      options: {
        emailRedirectTo: `${requestOrigin(request)}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      const text = `${error.code ?? ""} ${error.message}`.toLowerCase();
      logger.warn("auth.sign_up.rejected", { code: error.code ?? error.name ?? "unknown" });
      if (text.includes("already")) {
        return jsonError(400, "That email is already registered. Sign in instead.");
      }
      if (text.includes("rate") || error.status === 429) {
        return jsonError(429, authFailureMessage("rate"));
      }
      return jsonError(400, authFailureMessage("generic"));
    }

    if (data.session && data.user) {
      await openAppAccess(data.user.id, body.timezone);
      await recordSignIn(data.user.id, clientIp(request));
      try {
        await recordConsent({
          userId: data.user.id,
          purpose: "terms",
          source: "sign-up",
          ip: clientIp(request),
        });
      } catch (error) {
        logger.warn("auth.sign_up.consent", {
          error: error instanceof Error ? error.message : "unknown",
        });
      }
      return authJson({ ok: true, session: true, destination: next });
    }

    return authJson({
      ok: true,
      session: false,
      confirmationRequired: true,
      maskedEmail: maskEmail(email),
    });
  } catch (error) {
    return handleRouteError(error, "auth.sign_up");
  }
}
