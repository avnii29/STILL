import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { handleRouteError, jsonError } from "@/lib/http";
import { getPrisma } from "@/lib/prisma";
import { threadActionSchema } from "@/lib/validation/schemas";
import { applyThreadAction } from "@/lib/threads/actions";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const prisma = getPrisma();
    const thread = await prisma.thread.findFirst({
      where: { id, userId: user.id },
      include: {
        person: true,
        commitments: true,
        events: { orderBy: { createdAt: "asc" } },
        resolution: true,
        sourceMessage: true,
      },
    });
    if (!thread) return jsonError(404, "That thread is not here.");
    return NextResponse.json({ thread });
  } catch (error) {
    return handleRouteError(error, "threads.get");
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const result = await applyThreadAction({
      user,
      threadId: id,
      action: "delete",
    });
    if (!result) return jsonError(404, "That thread is not here.");
    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error, "threads.delete");
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const body = threadActionSchema.parse(await request.json());
    const result = await applyThreadAction({
      user,
      threadId: id,
      action: body.action,
      resolutionKind: body.resolutionKind,
      note: body.note,
      proposalId: body.proposalId,
      when: body.when,
    });
    if (!result) return jsonError(404, "That thread is not here.");
    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error, "threads.action");
  }
}
