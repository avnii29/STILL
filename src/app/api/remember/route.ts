import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { handleRouteError, jsonError, clientIp } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { rememberPayloadSchema } from "@/lib/validation/schemas";
import { rememberNote } from "@/lib/threads/ingest";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const limited = rateLimit(`remember:${user.id}`, 30, 10 * 60 * 1000);
    if (!limited.allowed) {
      return jsonError(429, "Give Still a moment.", { retryAfterMs: limited.retryAfterMs });
    }
    const body = rememberPayloadSchema.parse(await request.json());
    const result = await rememberNote({
      user,
      note: body.note,
      personName: body.personName,
      isSelf: body.isSelf,
      ip: clientIp(request),
      threadId: body.threadId,
      sourceKind:
        body.sourceKind === "VOICE"
          ? "VOICE"
          : body.sourceKind === "PASTE"
            ? "PASTE"
            : body.sourceKind === "TEXT"
              ? "TEXT"
              : "MANUAL",
    });
    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error, "remember");
  }
}
