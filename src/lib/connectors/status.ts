import type { ConnectorCapabilities, LiveStatus } from "@/lib/ingestion/types";
import { calendarLiveStatus, readCalendarMetadata } from "@/lib/connectors/google-calendar";

const NONE: ConnectorCapabilities = {
  read: false,
  write: false,
  realtime: false,
  notifications: false,
  search: false,
};

export function connectorCapabilities(provider: string, configured: boolean): ConnectorCapabilities {
  if (!configured) return NONE;
  if (provider === "CALENDAR") {
    return { read: true, write: true, realtime: true, notifications: false, search: true };
  }
  if (provider === "TELEGRAM" || provider === "WHATSAPP" || provider === "INSTAGRAM") {
    return { read: true, write: false, realtime: true, notifications: false, search: false };
  }
  if (provider === "EMAIL") {
    return { read: true, write: false, realtime: false, notifications: false, search: true };
  }
  if (provider === "VOICE") {
    return { read: true, write: false, realtime: false, notifications: false, search: false };
  }
  return NONE;
}

export function sourceLiveStatus(input: {
  provider: string;
  configured: boolean;
  status?: string | null;
  hasToken?: boolean;
  metadata?: unknown;
  now?: Date;
}): LiveStatus {
  if (!input.configured) return "NOT_YET_CONFIGURED";
  if (input.provider === "CALENDAR") {
    return calendarLiveStatus({
      configured: true,
      status: input.status,
      hasToken: Boolean(input.hasToken),
      metadata: readCalendarMetadata(input.metadata),
      now: input.now,
    });
  }
  if (!input.status || input.status === "NOT_CONNECTED" || input.status === "REQUIRES_ACTION") {
    return "NOT_CONNECTED";
  }
  if (input.status === "CONNECTING" || input.status === "PENDING") return "CONNECTING";
  if (input.status === "CONNECTED") return "LIVE";
  if (input.status === "DISCONNECTED") return "DISCONNECTED";
  if (input.status === "UNAVAILABLE") return "NOT_YET_CONFIGURED";
  if (input.status === "ERROR") return "ERROR";
  return "ERROR";
}
