import { NextResponse } from "next/server";
import { googleWebhookAuthorized, readCalendarMetadata } from "@/lib/connectors/google-calendar";
import {
  findCalendarAccountByChannel,
  syncGoogleCalendarAccount,
} from "@/lib/connectors/google-calendar-sync";
import { handleRouteError, jsonError } from "@/lib/http";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ok: true, provider: "CALENDAR" });
}

export async function POST(request: Request) {
  try {
    const channelId = request.headers.get("x-goog-channel-id");
    const channelToken = request.headers.get("x-goog-channel-token");
    const resourceState = request.headers.get("x-goog-resource-state");
    if (!channelId) return jsonError(400, "Missing channel.");

    const account = await findCalendarAccountByChannel(channelId);
    if (!account) return jsonError(404, "Unknown channel.");
    const watch = readCalendarMetadata(account.metadata).watches?.find((item) => item.id === channelId);
    if (
      !googleWebhookAuthorized({
        channelId,
        channelToken,
        expectedToken: watch?.token ?? null,
      })
    ) {
      return jsonError(401, "Invalid channel token.");
    }

    if (resourceState !== "sync") {
      try {
        await syncGoogleCalendarAccount(account.id, "webhook");
      } catch (error) {
        logger.warn("calendar.webhook_sync_failed", {
          message: error instanceof Error ? error.message : "failed",
        });
      }
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error, "calendar.webhook");
  }
}
