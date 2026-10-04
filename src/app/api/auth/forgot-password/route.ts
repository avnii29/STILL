import { z } from "zod";
import { authJson, prepareAuth } from "@/lib/auth/guard";
import { authFailureMessage, classifyAuthError, emailError, normalizeEmail } from "@/lib/auth/policy";
import { requestOrigin } from "@/lib/auth/request";
import { handleRouteError, jsonError } from "@/lib/http";
import { logger } from "@/lib/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().max(320),
  captchaToken: z.string().max(2048).optional(),
});

const NEUTRAL = "If an account exists for that address, we'll send instructions to reset your password.";

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const issue = emailError(body.email);
    if (issue) return jsonError(400, issue);
    const ready = await prepareAuth(request, "forgot", body.captchaToken);
    if (!ready.ok) return ready.response;

    const email = normalizeEmail(body.email);
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${requestOrigin(request)}/auth/callback?next=${encodeURIComponent("/reset-password")}`,
    });
    if (error) {
      const kind = classifyAuthError(error);
      logger.warn("auth.forgot.rejected", { code: error.code ?? error.name ?? "unknown" });
      if (kind === "rate") return jsonError(429, authFailureMessage("rate"));
      if (kind === "network") return jsonError(503, authFailureMessage("network"));
    }
    return authJson({ ok: true, message: NEUTRAL });
  } catch (error) {
    return handleRouteError(error, "auth.forgot");
  }
}
