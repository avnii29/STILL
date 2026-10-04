import { getServerEnv } from "@/lib/env";

export function isGoogleCalendarConfigured() {
  const env = getServerEnv();
  return Boolean(env.GOOGLE_CALENDAR_CLIENT_ID && env.GOOGLE_CALENDAR_CLIENT_SECRET);
}

export function isGoogleDocsConfigured() {
  const env = getServerEnv();
  return Boolean(env.GOOGLE_DOCS_CLIENT_ID && env.GOOGLE_DOCS_CLIENT_SECRET);
}

export function calendarStatus(connected: boolean) {
  if (!isGoogleCalendarConfigured()) {
    return {
      configured: false,
      connected: false,
      events: [] as const,
      message: "Not yet configured. Google Calendar OAuth credentials are missing.",
    };
  }
  if (!connected) {
    return {
      configured: true,
      connected: false,
      events: [] as const,
      message: "Google Calendar credentials exist, but this account has not connected yet.",
    };
  }
  return {
    configured: true,
    connected: true,
    events: [] as const,
    message: "Calendar is connected. Still will not invent events that are not on the calendar.",
  };
}

export function docsStatus(connected: boolean) {
  if (!isGoogleDocsConfigured()) {
    return {
      configured: false,
      connected: false,
      message: "Google Docs is not configured. Still will not pretend a document is open.",
    };
  }
  if (!connected) {
    return {
      configured: true,
      connected: false,
      message: "Google Docs credentials exist, but this account has not connected yet.",
    };
  }
  return {
    configured: true,
    connected: true,
    message: "Documents can be opened only after you approve.",
  };
}
