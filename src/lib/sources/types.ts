export type NormalizedMessage = {
  id: string;
  userId: string;
  provider: "TELEGRAM" | "WHATSAPP" | "INSTAGRAM" | "EMAIL" | "CALENDAR" | "MEETINGS" | "MANUAL" | "VOICE" | "PASTE";
  externalMessageId: string;
  conversationId: string;
  sender: string;
  recipient: string | null;
  timestamp: Date | null;
  content: string;
  attachmentsMetadata: unknown;
  sourceUrl: string | null;
  permissionsContext: string;
  isFromUser: boolean;
};

export type ProviderCapability = {
  id: NormalizedMessage["provider"];
  title: string;
  available: boolean;
  limited: boolean;
  connectable: boolean;
  capability: string;
  alternative: string;
  unavailableReason?: string;
};

export type ProviderAdapter = {
  id: NormalizedMessage["provider"];
  getCapabilities(): ProviderCapability;
  normalizeMessage(input: Record<string, unknown>, userId: string): NormalizedMessage | null;
};
