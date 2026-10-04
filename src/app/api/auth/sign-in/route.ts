import { z } from "zod";
import { openAppAccess, recordSignIn } from "@/lib/auth";
import { authJson, prepareAuth } from "@/lib/auth/guard";
import { authFailureMessage, classifyAuthError, normalizeEmail } from "@/lib/auth/policy";
import { clientIp, handleRouteError, jsonError } from "@/lib/http";
import { logger } from "@/lib/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().max(320),
  password: z.string().min(1).max(200),
  captchaToken: z.string().max(2048).optional(),
  timezone: z.string().max(64).optional(),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const ready = await prepareAuth(request, "sign-in", body.captchaToken);
    if (!ready.ok) return ready.response;

    const email = normalizeEmail(body.email);
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password: body.password });
    if (error) {
      const kind = classifyAuthError(error) ?? "generic";
      logger.warn("auth.sign_in.rejected", { code: error.code ?? error.name ?? "unknown" });
      const status = kind === "rate" ? 429 : kind === "network" ? 503 : 401;
      return jsonError(status, authFailureMessage(kind === "generic" ? "credentials" : kind));
    }

    const { data } = await supabase.auth.getUser();
    if (data.user) {
      try {
        await openAppAccess(data.user.id, body.timezone);
        await recordSignIn(data.user.id, clientIp(request));
      } catch (error) {
        logger.warn("auth.sign_in.profile", {
          error: error instanceof Error ? error.message : "unknown",
        });
      }
    }
    return authJson({ ok: true, destination: "/app" });
  } catch (error) {
    return handleRouteError(error, "auth.sign_in");
  }
}
