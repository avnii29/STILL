import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { handleRouteError, jsonError } from "@/lib/http";
import { getPrisma } from "@/lib/prisma";
import { threadStatusSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const owner = url.searchParams.get("owner");
    const prisma = getPrisma();

    const threads = await prisma.thread.findMany({
      where: {
        userId: user.id,
        ...(status ? { status: threadStatusSchema.parse(status) } : {}),
        ...(owner === "SELF" ? { owner: "SELF" } : {}),
      },
      include: { person: true },
      orderBy: { lastEvidenceAt: "desc" },
    });

    return NextResponse.json({
      threads: threads.map((thread) => ({
        id: thread.id,
        title: thread.title,
        summary: thread.summary,
        status: thread.status,
        owner: thread.owner,
        commitmentType: thread.commitmentType,
        person: thread.person ? { id: thread.person.id, name: thread.person.name } : null,
        lastEvidenceAt: thread.lastEvidenceAt,
        suggestedNextAction: thread.suggestedNextAction,
        needsUserReview: thread.needsUserReview,
      })),
    });
  } catch (error) {
    return handleRouteError(error, "threads.list");
  }
}

export async function POST() {
  return jsonError(405, "Create threads by ingesting authorized conversation.");
}
