import "server-only";

import { randomBytes, randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { recordConsent } from "@/lib/consent";
import {
  CALENDAR_PUSH_UNAVAILABLE,
  activeWatches,
  googleWebhookUrl,
  readCalendarMetadata,
  readCalendarMove,
  webhookCanPush,
  type CalendarMetadata,
  type CalendarWatch,
} from "@/lib/connectors/google-calendar";
import { getAppUrl, getServerEnv } from "@/lib/env";
import { beginIngestion, markIngestion } from "@/lib/ingestion/event-bus";
import { applyCalendarUpdate } from "@/lib/ingestion/processor";
import { calendarInstant, normalizeCalendarItem, type CalendarItemInput } from "@/lib/ingestion/normalizer";
import { routeContent } from "@/lib/ingestion/router";
import { isGoogleCalendarConfigured } from "@/lib/integrations/google";
import { logger } from "@/lib/logger";
import { getPrisma } from "@/lib/prisma";
import { processNormalizedMessage } from "@/lib/sources/pipeline";

type TokenSet = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope?: string;
};

export class GoogleAuthExpiredError extends Error {
  constructor() {
    super("Authorization expired");
    this.name = "GoogleAuthExpiredError";
  }
}

function readToken(raw: string | null): TokenSet | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<TokenSet>;
    if (!value.accessToken || !value.refreshToken || typeof value.expiresAt !== "number") return null;
    return {
      accessToken: value.accessToken,
      refreshToken: value.refreshToken,
      expiresAt: value.expiresAt,
      scope: value.scope,
    };
  } catch {
    return null;
  }
}

async function googleFetch(url: string, token: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(12000),
  });
  if (response.status === 401) throw new GoogleAuthExpiredError();
  return response;
}

async function refreshToken(current: TokenSet) {
  const env = getServerEnv();
  const body = new URLSearchParams({
    client_id: env.GOOGLE_CALENDAR_CLIENT_ID ?? "",
    client_secret: env.GOOGLE_CALENDAR_CLIENT_SECRET ?? "",
    refresh_token: current.refreshToken,
    grant_type: "refresh_token",
  });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(12000),
  });
  if (response.status === 400 || response.status === 401) throw new GoogleAuthExpiredError();
  if (!response.ok) throw new Error(`Google token refresh failed (${response.status})`);
  const payload = (await response.json()) as { access_token?: string; expires_in?: number; scope?: string };
  if (!payload.access_token) throw new GoogleAuthExpiredError();
  return {
    accessToken: payload.access_token,
    refreshToken: current.refreshToken,
    expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000,
    scope: payload.scope ?? current.scope,
  } satisfies TokenSet;
}

export async function exchangeGoogleCode(input: { code: string; redirectUri: string }) {
  const env = getServerEnv();
  const body = new URLSearchParams({
    code: input.code,
    client_id: env.GOOGLE_CALENDAR_CLIENT_ID ?? "",
    client_secret: env.GOOGLE_CALENDAR_CLIENT_SECRET ?? "",
    redirect_uri: input.redirectUri,
    grant_type: "authorization_code",
  });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error(`Google authorization failed (${response.status})`);
  const payload = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };
  if (!payload.access_token || !payload.refresh_token) {
    throw new Error("Google did not return a refresh token.");
  }
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000,
    scope: payload.scope,
  } satisfies TokenSet;
}

async function usableToken(accountId: string, current: TokenSet) {
  if (current.expiresAt > Date.now() + 60_000) return current;
  const next = await refreshToken(current);
  const prisma = getPrisma();
  await prisma.integrationAccount.update({
    where: { id: accountId },
    data: { tokenCipher: JSON.stringify(next) },
  });
  return next;
}

async function markAuthExpired(accountId: string, userId: string) {
  const prisma = getPrisma();
  const account = await prisma.integrationAccount.findUnique({ where: { id: accountId } });
  const metadata = readCalendarMetadata(account?.metadata);
  await prisma.integrationAccount.update({
    where: { id: accountId },
    data: {
      status: "ERROR",
      lastError: "Authorization expired. Reconnect Google Calendar.",
      metadata: { ...metadata, authExpired: true, liveStatus: "AUTH_EXPIRED" } as Prisma.InputJsonValue,
    },
  });
  await writeAuditLog({
    userId,
    action: "INTEGRATION_DISCONNECTED",
    target: "CALENDAR",
    metadata: { reason: "auth_expired" },
  });
}

async function listCalendars(token: string) {
  const response = await googleFetch(
    "https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=10",
    token,
  );
  if (!response.ok) throw new Error(`Google calendar list failed (${response.status})`);
  const payload = (await response.json()) as {
    items?: { id?: string; summary?: string; primary?: boolean }[];
  };
  return (payload.items ?? [])
    .filter((item) => item.id)
    .slice(0, 5)
    .map((item) => ({ id: item.id as string, summary: item.summary || item.id || "Calendar" }));
}

async function listChanges(input: {
  token: string;
  calendarId: string;
  syncToken?: string;
  timeMin?: string;
}) {
  const items: CalendarItemInput[] = [];
  let pageToken: string | undefined;
  let nextSyncToken = input.syncToken;
  for (let page = 0; page < 5; page += 1) {
    const url = new URL(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(input.calendarId)}/events`,
    );
    url.searchParams.set("singleEvents", "true");
    url.searchParams.set("showDeleted", "true");
    url.searchParams.set("maxResults", "50");
    if (input.syncToken && page === 0) url.searchParams.set("syncToken", input.syncToken);
    else if (input.timeMin) url.searchParams.set("timeMin", input.timeMin);
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const response = await googleFetch(url.toString(), input.token);
    if (response.status === 410) return { items, nextSyncToken: undefined, reset: true };
    if (!response.ok) throw new Error(`Google events list failed (${response.status})`);
    const payload = (await response.json()) as {
      items?: CalendarItemInput[];
      nextPageToken?: string;
      nextSyncToken?: string;
    };
    items.push(...(payload.items ?? []));
    if (payload.nextSyncToken) nextSyncToken = payload.nextSyncToken;
    if (!payload.nextPageToken) break;
    pageToken = payload.nextPageToken;
  }
  return { items, nextSyncToken, reset: false };
}

async function ensureWatch(input: {
  token: string;
  calendarId: string;
  existing?: CalendarWatch;
  webhookUrl: string;
}) {
  const now = Date.now();
  if (input.existing && Date.parse(input.existing.expiration) > now + 24 * 3600 * 1000) {
    return input.existing;
  }
  if (input.existing?.resourceId) {
    await googleFetch("https://www.googleapis.com/calendar/v3/channels/stop", input.token, {
      method: "POST",
      body: JSON.stringify({ id: input.existing.id, resourceId: input.existing.resourceId }),
    }).catch(() => undefined);
  }
  const channel: CalendarWatch = {
    id: randomUUID(),
    resourceId: "",
    token: randomBytes(24).toString("hex"),
    expiration: new Date(now + 6 * 24 * 3600 * 1000).toISOString(),
    calendarId: input.calendarId,
  };
  const response = await googleFetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(input.calendarId)}/events/watch`,
    input.token,
    {
      method: "POST",
      body: JSON.stringify({
        id: channel.id,
        type: "web_hook",
        address: input.webhookUrl,
        token: channel.token,
        expiration: String(Date.parse(channel.expiration)),
      }),
    },
  );
  if (!response.ok) throw new Error(`Google watch failed (${response.status})`);
  const payload = (await response.json()) as { resourceId?: string; expiration?: string };
  if (!payload.resourceId) throw new Error("Google watch did not return a resource id.");
  return {
    ...channel,
    resourceId: payload.resourceId,
    expiration: payload.expiration ? new Date(Number(payload.expiration)).toISOString() : channel.expiration,
  };
}

export async function syncGoogleCalendarAccount(accountId: string, reason: "initial" | "webhook" | "reconcile") {
  if (!isGoogleCalendarConfigured()) throw new Error("Google Calendar is not configured.");
  const prisma = getPrisma();
  const account = await prisma.integrationAccount.findUnique({ where: { id: accountId } });
  if (!account || account.provider !== "CALENDAR") throw new Error("Calendar account is missing.");
  const tokenSet = readToken(account.tokenCipher);
  if (!tokenSet) throw new Error("Calendar token is missing.");
  const metadata = readCalendarMetadata(account.metadata);
  await prisma.integrationAccount.update({
    where: { id: account.id },
    data: { metadata: { ...metadata, liveStatus: "SYNCING", authExpired: false } as Prisma.InputJsonValue },
  });

  let token: TokenSet;
  try {
    token = await usableToken(account.id, tokenSet);
  } catch (error) {
    if (error instanceof GoogleAuthExpiredError) {
      await markAuthExpired(account.id, account.userId);
    }
    throw error;
  }

  const calendars = await listCalendars(token.accessToken);
  await prisma.integrationAccount.update({
    where: { id: account.id },
    data: {
      status: "CONNECTED",
      connectedAt: account.connectedAt ?? new Date(),
    },
  });
  const lookback = metadata.lookbackDays ?? 7;
  const timeMin = new Date(Date.now() - lookback * 24 * 3600 * 1000).toISOString();
  const syncTokens: Record<string, string> = { ...(metadata.syncTokens ?? {}) };
  let scanned = 0;
  let conflicts = 0;
  let updated = 0;
  let lastEventAt = metadata.lastEventAt;

  for (const calendar of calendars) {
    let listed = await listChanges({
      token: token.accessToken,
      calendarId: calendar.id,
      syncToken: reason === "initial" ? undefined : syncTokens[calendar.id],
      timeMin,
    });
    if (listed.reset) {
      delete syncTokens[calendar.id];
      listed = await listChanges({
        token: token.accessToken,
        calendarId: calendar.id,
        timeMin,
      });
    }
    if (listed.nextSyncToken) syncTokens[calendar.id] = listed.nextSyncToken;
    for (const item of listed.items) {
      const inbound = normalizeCalendarItem({
        userId: account.userId,
        calendarId: calendar.id,
        item,
      });
      if (!inbound) continue;
      scanned += 1;
      const tracked = await beginIngestion({
        userId: account.userId,
        connectorId: account.id,
        provider: "CALENDAR",
        externalEventId: inbound.externalId,
        eventType: "calendar.event",
        occurredAt: new Date(inbound.occurredAt),
        payload: inbound.externalId,
        route: "context_update",
        summary: item.status === "cancelled" ? "Calendar event cancelled." : "Calendar event changed.",
      });
      if (tracked?.duplicate) continue;
      const startsAt = calendarInstant(item.start);
      const endsAt = calendarInstant(item.end);
      const applied = await applyCalendarUpdate({
        userId: account.userId,
        accountId: account.id,
        calendarId: calendar.id,
        eventId: item.id as string,
        title: item.summary?.trim() || "Calendar event",
        status: item.status ?? "confirmed",
        startsAt,
        endsAt,
        timeZone: item.start?.timeZone ?? null,
        htmlLink: item.htmlLink ?? null,
        updatedRemote: item.updated ?? null,
      });
      conflicts += applied.conflicts;
      if (applied.changed) updated += 1;
      const text = [item.summary, item.description].filter(Boolean).join("\n");
      const route = routeContent(text);
      if (route !== "ignore" && route !== "context_update") {
        try {
          await processNormalizedMessage(
            {
              id: inbound.externalId,
              userId: account.userId,
              provider: "CALENDAR",
              externalMessageId: `${item.id}:text:${item.updated ?? inbound.occurredAt}`,
              conversationId: calendar.id,
              sender: "calendar",
              recipient: null,
              timestamp: startsAt,
              content: text.slice(0, 4000),
              attachmentsMetadata: null,
              sourceUrl: item.htmlLink ?? null,
              permissionsContext: "google_calendar_event",
              isFromUser: true,
            },
            { accountId: account.id },
          );
        } catch (error) {
          logger.warn("calendar.text_pipeline_failed", {
            message: error instanceof Error ? error.message : "failed",
          });
        }
      }
      if (tracked) {
        await markIngestion(tracked.id, applied.conflicts || applied.changed ? "THREAD_UPDATED" : "PROCESSED", {
          route: applied.conflicts ? "deadline_change" : "context_update",
          summary: applied.conflicts
            ? "Calendar overlap needs approval."
            : "Context updated but no user action required.",
        });
      }
      if (inbound.occurredAt > (lastEventAt ?? "")) lastEventAt = inbound.occurredAt;
    }
  }

  const appUrl = getAppUrl();
  const watches: CalendarWatch[] = [];
  let watchError: string | null = null;
  if (webhookCanPush(appUrl)) {
    try {
      for (const calendar of calendars) {
        const existing = (metadata.watches ?? []).find((watch) => watch.calendarId === calendar.id);
        watches.push(
          await ensureWatch({
            token: token.accessToken,
            calendarId: calendar.id,
            existing,
            webhookUrl: googleWebhookUrl(appUrl),
          }),
        );
      }
    } catch (error) {
      watchError = error instanceof Error ? error.message : "Watch failed.";
      logger.warn("calendar.watch_failed", { message: watchError });
    }
  } else {
    watchError = CALENDAR_PUSH_UNAVAILABLE;
  }

  const live = watches.length > 0 && activeWatches({ watches }).length > 0;
  const next: CalendarMetadata = {
    ...metadata,
    calendars,
    syncTokens,
    watches: watches.length > 0 ? watches : metadata.watches,
    lastEventAt,
    lastSuccessfulSyncAt: new Date().toISOString(),
    authExpired: false,
    liveStatus: live ? "LIVE" : "DEGRADED",
    scan: { scanned, conflicts, updated, at: new Date().toISOString() },
  };
  await prisma.integrationAccount.update({
    where: { id: account.id },
    data: {
      status: "CONNECTED",
      connectedAt: account.connectedAt ?? new Date(),
      lastSyncAt: new Date(),
      lastError: live ? null : watchError,
      metadata: next as Prisma.InputJsonValue,
    },
  });
  return { scanned, conflicts, updated, live };
}

export async function stopGoogleWatches(account: { id: string; tokenCipher: string | null; metadata: unknown }) {
  const tokenSet = readToken(account.tokenCipher);
  const metadata = readCalendarMetadata(account.metadata);
  if (!tokenSet) return;
  let token = tokenSet;
  try {
    token = await usableToken(account.id, tokenSet);
  } catch {
    return;
  }
  for (const watch of metadata.watches ?? []) {
    if (!watch.resourceId) continue;
    await googleFetch("https://www.googleapis.com/calendar/v3/channels/stop", token.accessToken, {
      method: "POST",
      body: JSON.stringify({ id: watch.id, resourceId: watch.resourceId }),
    }).catch(() => undefined);
  }
}

export async function findCalendarAccountByChannel(channelId: string) {
  const prisma = getPrisma();
  const accounts = await prisma.integrationAccount.findMany({
    where: { provider: "CALENDAR", status: { not: "DISCONNECTED" } },
  });
  return (
    accounts.find((account) =>
      readCalendarMetadata(account.metadata).watches?.some((watch) => watch.id === channelId),
    ) ?? null
  );
}

export type ListedCalendarEvent = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  calendarId: string;
  source: "google" | "local";
  priority?: string;
};

export async function listCalendarEvents(input: { userId: string; day: Date }): Promise<ListedCalendarEvent[]> {
  const start = new Date(input.day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const local = await listLocalCalendarEvents(input.userId, start, end);

  if (!isGoogleCalendarConfigured()) return local;
  const prisma = getPrisma();
  const account = await prisma.integrationAccount.findUnique({
    where: { userId_provider: { userId: input.userId, provider: "CALENDAR" } },
  });
  const stored = readToken(account?.tokenCipher ?? null);
  if (!account || account.status !== "CONNECTED" || !stored) return local;

  try {
    const token = await usableToken(account.id, stored);
    const listed = await listChanges({
      token: token.accessToken,
      calendarId: "primary",
      timeMin: start.toISOString(),
    });
    const remote = listed.items.flatMap((item) => {
      const startsAt = item.start?.dateTime ?? (item.start?.date ? `${item.start.date}T00:00:00` : null);
      const endsAt = item.end?.dateTime ?? (item.end?.date ? `${item.end.date}T00:00:00` : null);
      if (!item.id || !startsAt || !endsAt) return [];
      if (item.status === "cancelled") return [];
      const when = new Date(startsAt);
      if (when < start || when >= end) return [];
      return [
        {
          id: item.id,
          title: item.summary || "Untitled",
          startsAt: new Date(startsAt).toISOString(),
          endsAt: new Date(endsAt).toISOString(),
          calendarId: "primary",
          source: "google" as const,
        },
      ];
    });
    return remote.length > 0 ? remote : local;
  } catch (error) {
    logger.warn("calendar.list_failed", {
      message: error instanceof Error ? error.message : "failed",
    });
    return local;
  }
}

async function listLocalCalendarEvents(userId: string, start: Date, end: Date): Promise<ListedCalendarEvent[]> {
  const prisma = getPrisma();
  const rows = await prisma.calendarEvent.findMany({
    where: {
      userId,
      startsAt: { gte: start, lt: end },
      NOT: { status: "cancelled" },
    },
    orderBy: { startsAt: "asc" },
  });
  return rows.flatMap((row) => {
    if (!row.startsAt || !row.endsAt) return [];
    return [
      {
        id: row.id,
        title: row.title,
        startsAt: row.startsAt.toISOString(),
        endsAt: row.endsAt.toISOString(),
        calendarId: row.calendarId,
        source: "local" as const,
        priority: row.status === "high" ? "high" : undefined,
      },
    ];
  });
}

export async function executeCalendarMove(input: { userId: string; metadata: unknown }) {
  const move = readCalendarMove(input.metadata);
  if (!move) return { ok: false as const, message: "This proposal has no calendar change to apply." };
  if (move.calendarId === "local") {
    const prisma = getPrisma();
    const updated = await prisma.calendarEvent.updateMany({
      where: { id: move.eventId, userId: input.userId },
      data: { startsAt: new Date(move.start), endsAt: new Date(move.end) },
    });
    if (updated.count !== 1) {
      return { ok: false as const, message: "That event is not on your calendar." };
    }
    await writeAuditLog({
      userId: input.userId,
      action: "ACTION_APPROVED",
      target: move.eventId,
      metadata: { calendarId: "local" },
    });
    return { ok: true as const, message: "The calendar event was updated." };
  }
  if (!isGoogleCalendarConfigured()) {
    return { ok: false as const, message: "Google Calendar is not configured." };
  }
  const prisma = getPrisma();
  const account = await prisma.integrationAccount.findUnique({
    where: { userId_provider: { userId: input.userId, provider: "CALENDAR" } },
  });
  const tokenSet = readToken(account?.tokenCipher ?? null);
  if (!account || account.status !== "CONNECTED" || !tokenSet) {
    return { ok: false as const, message: "Google Calendar is not connected." };
  }
  try {
    const token = await usableToken(account.id, tokenSet);
    const response = await googleFetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(move.calendarId)}/events/${encodeURIComponent(move.eventId)}`,
      token.accessToken,
      {
        method: "PATCH",
        body: JSON.stringify({
          start: { dateTime: move.start },
          end: { dateTime: move.end },
        }),
      },
    );
    if (!response.ok) {
      return { ok: false as const, message: `Google did not update the event (${response.status}).` };
    }
    await prisma.calendarEvent.updateMany({
      where: { accountId: account.id, externalId: move.eventId },
      data: { startsAt: new Date(move.start), endsAt: new Date(move.end) },
    });
    await writeAuditLog({
      userId: input.userId,
      action: "ACTION_APPROVED",
      target: move.eventId,
      metadata: { calendarId: move.calendarId },
    });
    return { ok: true as const, message: "The calendar event was updated." };
  } catch (error) {
    if (error instanceof GoogleAuthExpiredError) {
      await markAuthExpired(account.id, input.userId);
      return { ok: false as const, message: "Authorization expired. Reconnect Google Calendar." };
    }
    return { ok: false as const, message: "Google Calendar did not accept the change." };
  }
}

export async function reconcileGoogleCalendars() {
  const prisma = getPrisma();
  const accounts = await prisma.integrationAccount.findMany({
    where: {
      provider: "CALENDAR",
      tokenCipher: { not: null },
      status: { in: ["CONNECTED", "ERROR"] },
    },
  });
  let synced = 0;
  let failed = 0;
  for (const account of accounts) {
    try {
      await syncGoogleCalendarAccount(account.id, "reconcile");
      synced += 1;
    } catch (error) {
      failed += 1;
      logger.warn("calendar.reconcile_failed", {
        message: error instanceof Error ? error.message : "failed",
      });
    }
  }
  return { synced, failed };
}

export async function connectGoogleCalendar(input: {
  userId: string;
  code: string;
  redirectUri: string;
  lookbackDays: number;
}) {
  const token = await exchangeGoogleCode({ code: input.code, redirectUri: input.redirectUri });
  const prisma = getPrisma();
  const account = await prisma.integrationAccount.upsert({
    where: { userId_provider: { userId: input.userId, provider: "CALENDAR" } },
    create: {
      userId: input.userId,
      provider: "CALENDAR",
      status: "CONNECTING",
      tokenCipher: JSON.stringify(token),
      scopes: token.scope?.split(" ") ?? [],
      metadata: { lookbackDays: input.lookbackDays, liveStatus: "SYNCING" } as Prisma.InputJsonValue,
    },
    update: {
      status: "CONNECTING",
      tokenCipher: JSON.stringify(token),
      scopes: token.scope?.split(" ") ?? [],
      linkCode: null,
      disconnectedAt: null,
      lastError: null,
      metadata: { lookbackDays: input.lookbackDays, liveStatus: "SYNCING", authExpired: false } as Prisma.InputJsonValue,
    },
  });
  await prisma.sourcePermission.upsert({
    where: { userId_provider: { userId: input.userId, provider: "CALENDAR" } },
    create: {
      userId: input.userId,
      provider: "CALENDAR",
      granted: true,
      scopes: token.scope?.split(" ") ?? [],
    },
    update: { granted: true, scopes: token.scope?.split(" ") ?? [] },
  });
  await recordConsent({
    userId: input.userId,
    purpose: "connect:CALENDAR",
    source: "CALENDAR",
    metadata: { lookbackDays: input.lookbackDays },
  });
  const result = await syncGoogleCalendarAccount(account.id, "initial");
  await writeAuditLog({
    userId: input.userId,
    action: "INTEGRATION_CONNECTED",
    target: "CALENDAR",
    metadata: { scanned: result.scanned, live: result.live },
  });
  return result;
}
