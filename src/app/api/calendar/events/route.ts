import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { handleRouteError, jsonError } from "@/lib/http";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const schema = z.object({
  title: z.string().trim().min(1).max(160),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  priority: z.enum(["normal", "high"]).optional(),
});

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const body = schema.parse(await request.json());
    const startsAt = new Date(body.startsAt);
    const endsAt = new Date(body.endsAt);
    if (endsAt.getTime() <= startsAt.getTime()) {
      return jsonError(400, "The event has to end after it starts.");
    }
    const prisma = getPrisma();
    const account = await prisma.integrationAccount.upsert({
      where: { userId_provider: { userId: user.id, provider: "MANUAL" } },
      update: {},
      create: {
        userId: user.id,
        provider: "MANUAL",
        status: "NOT_CONNECTED",
      },
    });
    const event = await prisma.calendarEvent.create({
      data: {
        userId: user.id,
        accountId: account.id,
        calendarId: "local",
        externalId: randomUUID(),
        title: body.title,
        status: body.priority === "high" ? "high" : "confirmed",
        startsAt,
        endsAt,
        timeZone: user.timezone,
      },
    });
    return NextResponse.json({
      event: {
        id: event.id,
        title: event.title,
        startsAt: event.startsAt?.toISOString() ?? null,
        endsAt: event.endsAt?.toISOString() ?? null,
        calendarId: event.calendarId,
        source: "local",
      },
    });
  } catch (error) {
    return handleRouteError(error, "calendar.events");
  }
}
