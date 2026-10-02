import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { requireApiUser } from "@/lib/auth";
import { recordConsent } from "@/lib/consent";
import { clientIp, handleRouteError } from "@/lib/http";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  purpose: z.string().trim().min(3).max(80),
  source: z.string().trim().min(2).max(40),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const body = bodySchema.parse(await request.json());
    const event = await recordConsent({
      userId: user.id,
      purpose: body.purpose,
      source: body.source,
      metadata: body.metadata as Prisma.InputJsonValue | undefined,
      ip: clientIp(request),
    });
    return NextResponse.json({ ok: true, id: event.id });
  } catch (error) {
    return handleRouteError(error, "consent");
  }
}
