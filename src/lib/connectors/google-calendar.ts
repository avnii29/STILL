import { timingSafeEqual } from "node:crypto";
import type { LiveStatus } from "@/lib/ingestion/types";

export const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
].join(" ");

export const CALENDAR_PUSH_UNAVAILABLE =
  "Push notifications need a public HTTPS address. STILL will reconcile on the scheduled check.";

export type CalendarWatch = {
  id: string;
  resourceId: string;
  token: string;
  expiration: string;
  calendarId: string;
};

export type CalendarMetadata = {
  lookbackDays?: number;
  email?: string;
  calendars?: { id: string; summary: string }[];
  syncTokens?: Record<string, string>;
  lastEventAt?: string;
  lastSuccessfulSyncAt?: string;
  watches?: CalendarWatch[];
  liveStatus?: string;
  authExpired?: boolean;
  scan?: { scanned: number; conflicts: number; updated: number; at: string };
};

export function readCalendarMetadata(value: unknown): CalendarMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as CalendarMetadata;
}

export function googleAuthUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
}) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("scope", GOOGLE_CALENDAR_SCOPES);
  url.searchParams.set("state", input.state);
  return url.toString();
}

export function googleRedirectUri(appUrl: string) {
  return new URL("/connectors/google-calendar/callback", appUrl).toString();
}

export function googleWebhookUrl(appUrl: string) {
  return new URL("/webhooks/google-calendar", appUrl).toString();
}

export function webhookCanPush(appUrl: string) {
  try {
    return new URL(appUrl).protocol === "https:";
  } catch {
    return false;
  }
}

export function activeWatches(metadata: CalendarMetadata, now = new Date()) {
  return (metadata.watches ?? []).filter((watch) => {
    const expiration = Date.parse(watch.expiration);
    return watch.resourceId && Number.isFinite(expiration) && expiration > now.getTime();
  });
}

export function calendarLiveStatus(input: {
  configured: boolean;
  status?: string | null;
  hasToken: boolean;
  metadata: CalendarMetadata;
  now?: Date;
}): LiveStatus {
  if (!input.configured) return "NOT_YET_CONFIGURED";
  if (input.metadata.authExpired) return "AUTH_EXPIRED";
  if (!input.status || input.status === "NOT_CONNECTED" || input.status === "REQUIRES_ACTION") {
    return "NOT_CONNECTED";
  }
  if (input.status === "DISCONNECTED") return "DISCONNECTED";
  if (input.status === "CONNECTING" || input.metadata.liveStatus === "CONNECTING") return "CONNECTING";
  if (input.metadata.liveStatus === "SYNCING") return "SYNCING";
  if (!input.hasToken) return input.status === "ERROR" ? "ERROR" : "NOT_CONNECTED";
  if (input.status === "ERROR") return "ERROR";
  const now = input.now ?? new Date();
  const liveWatch = activeWatches(input.metadata, now).length > 0;
  if (input.metadata.lastSuccessfulSyncAt && liveWatch) return "LIVE";
  if (input.metadata.lastSuccessfulSyncAt) return "DEGRADED";
  return "SYNCING";
}

export function googleWebhookAuthorized(input: {
  channelId: string | null;
  channelToken: string | null;
  expectedToken: string | null;
}) {
  if (!input.channelId || !input.channelToken || !input.expectedToken) return false;
  const left = Buffer.from(input.channelToken);
  const right = Buffer.from(input.expectedToken);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function readCalendarMove(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const value = metadata as Record<string, unknown>;
  if (
    typeof value.calendarId !== "string" ||
    typeof value.eventId !== "string" ||
    typeof value.start !== "string" ||
    typeof value.end !== "string"
  ) {
    return null;
  }
  return {
    calendarId: value.calendarId,
    eventId: value.eventId,
    start: value.start,
    end: value.end,
  };
}
