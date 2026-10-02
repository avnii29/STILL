import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { handleRouteError, jsonError } from "@/lib/http";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  remindAt: z.string().datetime(),
  body: z.string().trim().max(500).optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const prisma = getPrisma();
    const thread = await prisma.thread.findFirst({
      where: { id, userId: user.id },
    });
    if (!thread) return jsonError(404, "That thread is not here.");
    const body = bodySchema.parse(await request.json());
    const remindAt = new Date(body.remindAt);
    await prisma.reminder.updateMany({
      where: { threadId: thread.id, status: "SCHEDULED" },
      data: { status: "CANCELLED" },
    });
    const reminder = await prisma.reminder.create({
      data: {
        userId: user.id,
        threadId: thread.id,
        remindAt,
        channel: "WEB_PUSH",
        body: body.body || `You said you'd ${thread.title}.`,
      },
    });
    await prisma.threadEvent.create({
      data: {
        userId: user.id,
        threadId: thread.id,
        kind: "REMINDER_SCHEDULED",
        body: remindAt.toISOString(),
      },
    });
    return NextResponse.json({ reminder });
  } catch (error) {
    return handleRouteError(error, "threads.reminder");
  }
}
