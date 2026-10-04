import { z } from "zod";
import { authJson, prepareAuth } from "@/lib/auth/guard";
import { authFailureMessage, passwordError } from "@/lib/auth/policy";
import { handleRouteError, jsonError } from "@/lib/http";
import { logger } from "@/lib/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const schema = z.object({
  password: z.string().min(1).max(200),
  captchaToken: z.string().max(2048).optional(),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const issue = passwordError(body.password, "new");
    if (issue) return jsonError(400, issue);
    const ready = await prepareAuth(request, "reset", body.captchaToken);
    if (!ready.ok) return ready.response;

    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      return jsonError(401, "Open the reset link from your email, then choose a new password.");
    }
    const { error } = await supabase.auth.updateUser({ password: body.password });
    if (error) {
      logger.warn("auth.reset.rejected", { code: error.code ?? error.name ?? "unknown" });
      return jsonError(400, authFailureMessage("generic"));
    }
    return authJson({ ok: true, destination: "/app" });
  } catch (error) {
    return handleRouteError(error, "auth.reset");
  }
}
