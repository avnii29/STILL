import { describe, expect, it } from "vitest";
import {
  calendarLiveStatus,
  googleAuthUrl,
  googleWebhookAuthorized,
  webhookCanPush,
} from "@/lib/connectors/google-calendar";
import { sourceLiveStatus } from "@/lib/connectors/status";
import { ingestionKey } from "@/lib/ingestion/deduplicator";
import { normalizeCalendarItem, overlapsCommitment, proposedCalendarShift } from "@/lib/ingestion/normalizer";
import { routeContent, shouldInterrupt } from "@/lib/ingestion/router";
import { detectCommitment, scoreRelevance } from "@/lib/sources/detect";
import { isPublicPath } from "@/lib/supabase/proxy";

describe("real-time ingestion", () => {
  it("routes fulfillment, deadline changes, and ignores weather", () => {
    expect(routeContent("Sent Maya the dataset.")).toBe("fulfillment");
    expect(routeContent("Actually Friday works.")).toBe("deadline_change");
    expect(routeContent("No worries, Friday is fine.")).toBe("deadline_change");
    expect(routeContent("I'll send the report tomorrow.")).toBe("new_commitment");
    expect(routeContent("The weather is fine today.")).toBe("ignore");
    expect(shouldInterrupt("context_update").interrupt).toBe(false);
    expect(shouldInterrupt("fulfillment").interrupt).toBe(true);
  });

  it("treats a past-tense fulfillment as resolution evidence", () => {
    const result = detectCommitment({
      text: "Sent Maya the dataset.",
      now: new Date("2026-10-04T10:00:00.000Z"),
      timeZone: "Asia/Kolkata",
    });
    expect(result.classification).toBe("RESOLUTION_SIGNAL");
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    expect(scoreRelevance("Sent Maya the dataset.")).toBe("HIGH");
    expect(scoreRelevance("The weather is fine today.")).toBe("NONE");
  });

  it("dedupes on connector and external id", () => {
    expect(ingestionKey("acc_1", "evt_1")).toBe("acc_1:evt_1");
    const first = normalizeCalendarItem({
      userId: "user",
      calendarId: "cal",
      item: { id: "evt", updated: "2026-10-04T10:00:00.000Z", summary: "Meeting" },
    });
    const retry = normalizeCalendarItem({
      userId: "user",
      calendarId: "cal",
      item: { id: "evt", updated: "2026-10-04T10:00:00.000Z", summary: "Meeting" },
    });
    expect(first?.externalId).toBe(retry?.externalId);
  });

  it("does not call a calendar live without a token and an active watch", () => {
    expect(
      calendarLiveStatus({
        configured: false,
        hasToken: false,
        metadata: {},
      }),
    ).toBe("NOT_YET_CONFIGURED");
    expect(
      calendarLiveStatus({
        configured: true,
        status: "CONNECTED",
        hasToken: true,
        metadata: { lastSuccessfulSyncAt: "2026-10-04T10:00:00.000Z" },
      }),
    ).toBe("DEGRADED");
    expect(
      calendarLiveStatus({
        configured: true,
        status: "CONNECTED",
        hasToken: true,
        metadata: {
          lastSuccessfulSyncAt: "2026-10-04T10:00:00.000Z",
          watches: [
            {
              id: "ch",
              resourceId: "res",
              token: "tok",
              expiration: "2026-10-05T10:00:00.000Z",
              calendarId: "cal",
            },
          ],
        },
        now: new Date("2026-10-04T12:00:00.000Z"),
      }),
    ).toBe("LIVE");
    expect(
      sourceLiveStatus({
        provider: "WHATSAPP",
        configured: false,
      }),
    ).toBe("NOT_YET_CONFIGURED");
  });

  it("rejects a calendar webhook with the wrong channel token", () => {
    expect(
      googleWebhookAuthorized({
        channelId: "ch",
        channelToken: "nope",
        expectedToken: "secret-token",
      }),
    ).toBe(false);
    expect(
      googleWebhookAuthorized({
        channelId: "ch",
        channelToken: "secret-token",
        expectedToken: "secret-token",
      }),
    ).toBe(true);
    expect(webhookCanPush("http://localhost:3000")).toBe(false);
    expect(webhookCanPush("https://still.example")).toBe(true);
  });

  it("builds a Google OAuth URL without marking the account connected", () => {
    const url = new URL(
      googleAuthUrl({
        clientId: "client",
        redirectUri: "http://localhost:3000/connectors/google-calendar/callback",
        state: "state",
      }),
    );
    expect(url.origin).toBe("https://accounts.google.com");
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("scope")).toContain("calendar.events");
    expect(url.searchParams.get("connected")).toBeNull();
  });

  it("proposes a calendar move only when a commitment overlaps the event", () => {
    const dueAt = new Date("2026-10-06T10:30:00.000Z");
    const startsAt = new Date("2026-10-06T10:00:00.000Z");
    const endsAt = new Date("2026-10-06T11:00:00.000Z");
    expect(overlapsCommitment({ dueAt, startsAt, endsAt })).toBe(true);
    const shift = proposedCalendarShift({ dueAt, startsAt, endsAt });
    expect(shift.start.getTime()).toBeGreaterThan(dueAt.getTime());
    expect(
      overlapsCommitment({
        dueAt,
        startsAt: new Date("2026-10-06T15:00:00.000Z"),
        endsAt: new Date("2026-10-06T16:00:00.000Z"),
      }),
    ).toBe(false);
  });

  it("keeps the Google webhook and OAuth callback public", () => {
    expect(isPublicPath("/webhooks/google-calendar")).toBe(true);
    expect(isPublicPath("/connectors/google-calendar/callback")).toBe(true);
    expect(isPublicPath("/connectors/google-calendar/watch")).toBe(false);
  });
});
