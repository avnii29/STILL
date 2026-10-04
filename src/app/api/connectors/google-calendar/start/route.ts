import { NextResponse } from "next/server";
import { z } from "zod";
import { randomLinkCode } from "@/lib/sources/accounts";
import { requireApiUser } from "@/lib/auth";
import type { Prisma } from "@/generated/prisma/client";
import { googleAuthUrl, googleRedirectUri, readCalendarMetadata } from "@/lib/connectors/google-calendar";
import { getAppUrl, getServerEnv } from "@/lib/env";
import { handleRouteError, jsonError } from "@/lib/http";
import { isGoogleCalendarConfigured } from "@/lib/integrations/google";
import { getPrisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  lookbackDays: z.number().int().min(1).max(90).default(7),
});

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const limited = rateLimit(`calendar-start:${user.id}`, 10, 10 * 60 * 1000);
    if (!limited.allowed) {
      return jsonError(429, "Give STILL a moment.", { retryAfterMs: limited.retryAfterMs });
    }
    if (!isGoogleCalendarConfigured()) {
      return jsonError(409, "Google Calendar is not yet configured.");
    }
    const body = bodySchema.parse(await request.json().catch(() => ({})));
    const prisma = getPrisma();
    const existing = await prisma.integrationAccount.findUnique({
      where: { userId_provider: { userId: user.id, provider: "CALENDAR" } },
    });
    const state = randomLinkCode();
    const metadata = {
      ...readCalendarMetadata(existing?.metadata),
      lookbackDays: body.lookbackDays,
      liveStatus: existing?.status === "CONNECTED" ? readCalendarMetadata(existing.metadata).liveStatus : "CONNECTING",
    };
    await prisma.integrationAccount.upsert({
      where: { userId_provider: { userId: user.id, provider: "CALENDAR" } },
      create: {
        userId: user.id,
        provider: "CALENDAR",
        status: "CONNECTING",
        linkCode: state,
        metadata: metadata as Prisma.InputJsonValue,
      },
      update: {
        linkCode: state,
        status: existing?.status === "CONNECTED" ? "CONNECTED" : "CONNECTING",
        metadata: metadata as Prisma.InputJsonValue,
      },
    });
    const env = getServerEnv();
    const url = googleAuthUrl({
      clientId: env.GOOGLE_CALENDAR_CLIENT_ID ?? "",
      redirectUri: googleRedirectUri(getAppUrl()),
      state,
    });
    return NextResponse.json({ ok: true, url });
  } catch (error) {
    return handleRouteError(error, "calendar.start");
  }
}
