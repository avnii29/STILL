import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { handleRouteError, jsonError } from "@/lib/http";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const prisma = getPrisma();
    const person = await prisma.person.findFirst({
      where: { id, userId: user.id },
      include: {
        threads: { orderBy: { lastEvidenceAt: "desc" } },
      },
    });
    if (!person) return jsonError(404, "That person is not here.");
    return NextResponse.json({ person });
  } catch (error) {
    return handleRouteError(error, "people.get");
  }
}
