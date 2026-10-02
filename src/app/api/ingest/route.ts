import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { handleRouteError, jsonError, clientIp } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { ingestPayloadSchema } from "@/lib/validation/schemas";
import { ingestConversation } from "@/lib/threads/ingest";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const limited = rateLimit(`ingest:${user.id}`, 20, 10 * 60 * 1000);
    if (!limited.allowed) {
      return jsonError(429, "Give Still a moment. Too many interpretations just now.", {
        retryAfterMs: limited.retryAfterMs,
      });
    }

    const body = ingestPayloadSchema.parse(await request.json());
    const result = await ingestConversation({
      user,
      conversationText: body.conversationText,
      personName: body.personName,
      title: body.title,
      ip: clientIp(request),
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error, "ingest");
  }
}
