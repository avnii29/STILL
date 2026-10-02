import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { handleRouteError, jsonError } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import {
  createMemoryFromCandidate,
  ignoreCandidate,
  undoCandidateMemory,
} from "@/lib/sources/pipeline";
import { resolveTemporal } from "@/lib/sources/temporal";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  action: z.enum(["remember", "ignore", "undo", "when"]),
  when: z.enum(["later_today", "tomorrow", "evening"]).optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    const limited = rateLimit(`candidate:${user.id}`, 40, 10 * 60 * 1000);
    if (!limited.allowed) {
      return jsonError(429, "Give STILL a moment.", { retryAfterMs: limited.retryAfterMs });
    }
    const { id } = await context.params;
    const body = bodySchema.parse(await request.json());
    const prisma = getPrisma();
    const candidate = await prisma.memoryCandidate.findFirst({
      where: { id, userId: user.id },
    });
    if (!candidate) return jsonError(404, "That candidate is gone.");

    if (body.action === "ignore") {
      await ignoreCandidate({ userId: user.id, candidateId: id });
      return NextResponse.json({ ok: true, status: "IGNORED" });
    }
    if (body.action === "undo") {
      await undoCandidateMemory({ user, candidateId: id });
      return NextResponse.json({ ok: true, status: "IGNORED" });
    }
    const dueAt =
      body.action === "when" && body.when
        ? resolveTemporal({
            text:
              body.when === "later_today"
                ? "later today"
                : body.when === "evening"
                  ? "this evening"
                  : "tomorrow",
            timeZone: user.timezone,
          })?.dueAt ?? null
        : undefined;
    const memory = await createMemoryFromCandidate({ user, candidateId: id, dueAt });
    return NextResponse.json({ ok: true, threadId: memory.threadId });
  } catch (error) {
    return handleRouteError(error, "memory.candidate");
  }
}
