import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { handleRouteError } from "@/lib/http";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function DELETE() {
  try {
    const user = await requireApiUser();
    const prisma = getPrisma();
    const [messages, conversations, sourceMessages, sourceConversations] = await Promise.all([
      prisma.message.deleteMany({ where: { userId: user.id } }),
      prisma.conversation.deleteMany({ where: { userId: user.id } }),
      prisma.sourceMessage.deleteMany({ where: { userId: user.id } }),
      prisma.sourceConversation.deleteMany({ where: { userId: user.id } }),
    ]);
    await writeAuditLog({
      userId: user.id,
      action: "SOURCE_DATA_DELETED",
      target: "source-data",
      metadata: {
        messages: messages.count,
        conversations: conversations.count,
        sourceMessages: sourceMessages.count,
        sourceConversations: sourceConversations.count,
      },
    });
    return NextResponse.json({
      ok: true,
      deleted: {
        messages: messages.count,
        conversations: conversations.count,
        sourceMessages: sourceMessages.count,
        sourceConversations: sourceConversations.count,
      },
    });
  } catch (error) {
    return handleRouteError(error, "account.source-data");
  }
}
