import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { syncGoogleCalendarAccount } from "@/lib/connectors/google-calendar-sync";
import { handleRouteError, jsonError } from "@/lib/http";
import { isGoogleCalendarConfigured } from "@/lib/integrations/google";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const user = await requireApiUser();
    if (!isGoogleCalendarConfigured()) return jsonError(409, "Google Calendar is not yet configured.");
    const prisma = getPrisma();
    const account = await prisma.integrationAccount.findUnique({
      where: { userId_provider: { userId: user.id, provider: "CALENDAR" } },
    });
    if (!account?.tokenCipher) return jsonError(409, "Google Calendar is not connected.");
    const result = await syncGoogleCalendarAccount(account.id, "reconcile");
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return handleRouteError(error, "calendar.watch");
  }
}
