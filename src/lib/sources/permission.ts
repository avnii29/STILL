import type { IntegrationStatus, SourceProvider } from "@/generated/prisma/client";

const ALWAYS_PERMITTED: SourceProvider[] = ["MANUAL", "VOICE", "PASTE"];

export function isAlwaysPermitted(provider: SourceProvider | string) {
  return ALWAYS_PERMITTED.includes(provider as SourceProvider);
}

export function canIngest(input: {
  status?: IntegrationStatus | null;
  granted?: boolean | null;
  provider: SourceProvider | string;
}) {
  if (isAlwaysPermitted(input.provider)) return true;
  return input.status === "CONNECTED" && input.granted === true;
}

export function ingestionStoppedReason(input: {
  status?: IntegrationStatus | null;
  granted?: boolean | null;
}) {
  if (input.status === "DISCONNECTED" || input.status === "NOT_CONNECTED") {
    return "This source is disconnected. STILL will not ingest new messages.";
  }
  if (input.status === "ERROR") {
    return "This source is not responding right now. Your existing memories are safe.";
  }
  if (input.granted !== true) {
    return "STILL does not have permission to use this source.";
  }
  if (input.status !== "CONNECTED") {
    return "This source is not connected.";
  }
  return null;
}
