import { z } from "zod";
import { authJson, prepareAuth } from "@/lib/auth/guard";
import { handleRouteError } from "@/lib/http";

export const dynamic = "force-dynamic";

const schema = z.object({
  captchaToken: z.string().max(2048).optional(),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const ready = await prepareAuth(request, "captcha", body.captchaToken);
    if (!ready.ok) return ready.response;
    return authJson({ ok: true });
  } catch (error) {
    return handleRouteError(error, "auth.captcha");
  }
}
