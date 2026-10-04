import { getServerEnv } from "@/lib/env";
import { calendarStatus } from "@/lib/integrations/google";
import type { ProviderAdapter, ProviderCapability } from "@/lib/sources/types";

const PASTE_FALLBACK = "Paste or forward the conversation to STILL.";

export function isTelegramConfigured() {
  return Boolean(getServerEnv().TELEGRAM_BOT_TOKEN);
}

export function telegramCapability(): ProviderCapability {
  if (!isTelegramConfigured()) {
    return {
      id: "TELEGRAM",
      title: "Telegram",
      available: false,
      limited: false,
      connectable: false,
      capability: "STILL can't access this source yet.",
      alternative: PASTE_FALLBACK,
      unavailableReason: "The official STILL Telegram bot is not configured in this environment.",
    };
  }
  return {
    id: "TELEGRAM",
    title: "Telegram",
    available: true,
    limited: true,
    connectable: true,
    capability:
      "Messages explicitly sent or forwarded to STILL can be processed. STILL cannot see private chats the bot is not in.",
    alternative: "Forward this message to STILL.",
  };
}

export function whatsappCapability(): ProviderCapability {
  const env = getServerEnv();
  const configured = Boolean(env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_APP_SECRET);
  if (!configured) {
    return {
      id: "WHATSAPP",
      title: "WhatsApp",
      available: false,
      limited: true,
      connectable: false,
      capability: "Availability depends on the official Meta API and the permissions that account can grant.",
      alternative: PASTE_FALLBACK,
      unavailableReason: "Official Meta/WhatsApp Cloud API credentials are not configured.",
    };
  }
  return {
    id: "WHATSAPP",
    title: "WhatsApp",
    available: true,
    limited: true,
    connectable: true,
    capability:
      "STILL can only access WhatsApp data that the official connection permits. It will not read a personal inbox.",
    alternative: PASTE_FALLBACK,
  };
}

export function instagramCapability(): ProviderCapability {
  const env = getServerEnv();
  const configured = Boolean(env.INSTAGRAM_ACCESS_TOKEN && env.INSTAGRAM_APP_SECRET);
  if (!configured) {
    return {
      id: "INSTAGRAM",
      title: "Instagram",
      available: false,
      limited: true,
      connectable: false,
      capability: "Instagram messaging isn't available for your account through the supported connection.",
      alternative: PASTE_FALLBACK,
      unavailableReason: "Requires a supported professional or business account through the official API. Credentials are not configured.",
    };
  }
  return {
    id: "INSTAGRAM",
    title: "Instagram",
    available: true,
    limited: true,
    connectable: true,
    capability: "STILL can only use Instagram messaging the official connection permits.",
    alternative: PASTE_FALLBACK,
  };
}

export function emailCapability(): ProviderCapability {
  const env = getServerEnv();
  const configured = Boolean(env.GOOGLE_CALENDAR_CLIENT_ID && env.GMAIL_ENABLED === "true");
  return {
    id: "EMAIL",
    title: "Email",
    available: configured,
    limited: true,
    connectable: configured,
    capability: configured
      ? "STILL will look for commitments in mail you authorize, not your entire inbox."
      : "STILL can't access this source yet.",
    alternative: PASTE_FALLBACK,
    unavailableReason: configured ? undefined : "An email provider is not configured.",
  };
}

export function calendarCapability(): ProviderCapability {
  const status = calendarStatus(false);
  return {
    id: "CALENDAR",
    title: "Calendar",
    available: status.configured,
    limited: true,
    connectable: status.configured,
    capability: status.configured
      ? "Read events, receive change notifications, and propose updates. Calendar is not a notification channel."
      : "Not yet configured.",
    alternative: "STILL can still remember deadlines you type or speak.",
    unavailableReason: status.configured
      ? undefined
      : "Google OAuth client id and secret are missing. STILL will not show this source as connected.",
  };
}

export function meetingsCapability(): ProviderCapability {
  return {
    id: "MEETINGS",
    title: "Meetings",
    available: false,
    limited: false,
    connectable: false,
    capability: "STILL can't access this source yet.",
    alternative: PASTE_FALLBACK,
    unavailableReason: "No meeting transcript provider is configured.",
  };
}

export function voiceCapability(): ProviderCapability {
  return {
    id: "VOICE",
    title: "Voice",
    available: true,
    limited: true,
    connectable: false,
    capability: "Speak a promise into STILL. Audio is not stored.",
    alternative: "Type or paste instead.",
  };
}

export const PROVIDERS: ProviderCapability[] = [];

export function providerCatalog(): ProviderCapability[] {
  return [
    telegramCapability(),
    whatsappCapability(),
    instagramCapability(),
    emailCapability(),
    calendarCapability(),
    meetingsCapability(),
    voiceCapability(),
  ];
}

export const adapters: Record<string, Pick<ProviderAdapter, "getCapabilities">> = {
  TELEGRAM: { getCapabilities: telegramCapability },
  WHATSAPP: { getCapabilities: whatsappCapability },
  INSTAGRAM: { getCapabilities: instagramCapability },
  EMAIL: { getCapabilities: emailCapability },
  CALENDAR: { getCapabilities: calendarCapability },
  MEETINGS: { getCapabilities: meetingsCapability },
  VOICE: { getCapabilities: voiceCapability },
};
