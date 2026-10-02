import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { handleRouteError, jsonError, clientIp } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { rememberPayloadSchema } from "@/lib/validation/schemas";
import { getLanguageModel } from "@/lib/agents/provider";
import { parseConversationText } from "@/lib/agents/ingestion";
import { detectThreadsFromMessages } from "@/lib/agents/pipeline";
import { extractCommitment } from "@/lib/agents/extract";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await requireApiUser();
    const limited = rateLimit(`detect:${clientIp(request)}`, 40, 10 * 60 * 1000);
    if (!limited.allowed) {
      return jsonError(429, "Give Still a moment.", { retryAfterMs: limited.retryAfterMs });
    }
    const body = rememberPayloadSchema.parse(await request.json());
    const extraction = extractCommitment({
      text: body.note,
      personHint: body.isSelf ? undefined : body.personName,
    });
    const messages = parseConversationText(`Me: ${body.note}`);
    const detections = await detectThreadsFromMessages({
      messages,
      personName: body.isSelf ? undefined : body.personName ?? extraction.person ?? undefined,
      model: getLanguageModel(),
    });
    const visible = detections.filter(
      (item) => item.shouldSurface || item.needs_user_review || item.uncertain,
    );
    return NextResponse.json({
      extraction,
      detections: visible.map((item) => ({
        title: item.normalizedCommitment || item.title,
        evidence: item.evidence,
        type: item.type,
        owner: item.owner,
        personName: item.personName ?? extraction.person ?? body.personName ?? null,
        dueHint: item.suggestedFollowUpAt ?? extraction.due_at,
        deadline: extraction.deadline,
        confidence: item.confidence,
        isThread: item.is_thread,
        uncertain: Boolean(item.uncertain),
        currentState: item.current_state,
        suggestedAction: item.suggested_action,
        normalized: item.normalizedCommitment ?? extraction.normalized_commitment,
      })),
      uncertain: extraction.uncertain || visible.length === 0 || visible.every((item) => !item.is_thread),
    });
  } catch (error) {
    return handleRouteError(error, "detect");
  }
}
