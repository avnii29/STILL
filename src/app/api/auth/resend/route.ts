import { z } from "zod";
import { authJson, prepareAuth } from "@/lib/auth/guard";
import { authFailureMessage, emailError, normalizeEmail } from "@/lib/auth/policy";
import { requestOrigin } from "@/lib/auth/request";
import { safeAuthNext } from "@/lib/auth/policy";
import { handleRouteError, jsonError } from "@/lib/http";
import { logger } from "@/lib/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().max(320),
  captchaToken: z.string().max(2048).optional(),
  next: z.string().max(300).optional(),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const issue = emailError(body.email);
    if (issue) return jsonError(400, issue);
    const ready = await prepareAuth(request, "resend", body.captchaToken);
    if (!ready.ok) return ready.response;

    const email = normalizeEmail(body.email);
    const next = safeAuthNext(body.next);
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: `${requestOrigin(request)}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      logger.warn("auth.resend.rejected", { code: error.code ?? error.name ?? "unknown" });
      const text = `${error.code ?? ""} ${error.message}`.toLowerCase();
      if (text.includes("rate") || error.status === 429) {
        return jsonError(429, authFailureMessage("rate"));
      }
      return jsonError(400, authFailureMessage("generic"));
    }
    return authJson({ ok: true });
  } catch (error) {
    return handleRouteError(error, "auth.resend");
  }
}
