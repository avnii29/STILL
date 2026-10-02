import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { handleRouteError, jsonError } from "@/lib/http";
import { getPrisma } from "@/lib/prisma";
import { personCreateSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireApiUser();
    const prisma = getPrisma();
    const people = await prisma.person.findMany({
      where: { userId: user.id },
      include: {
        _count: { select: { threads: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json({
      people: people.map((person) => ({
        id: person.id,
        name: person.name,
        howYouKnowThem: person.howYouKnowThem,
        openCount: person._count.threads,
      })),
    });
  } catch (error) {
    return handleRouteError(error, "people.list");
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const body = personCreateSchema.parse(await request.json());
    const prisma = getPrisma();
    const existing = await prisma.person.findFirst({
      where: { userId: user.id, name: { equals: body.name, mode: "insensitive" } },
    });
    if (existing) return jsonError(409, "That person is already here.");
    const person = await prisma.person.create({
      data: {
        userId: user.id,
        name: body.name,
        howYouKnowThem: body.howYouKnowThem,
        notes: body.notes,
      },
    });
    return NextResponse.json({ person });
  } catch (error) {
    return handleRouteError(error, "people.create");
  }
}
