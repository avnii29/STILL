export type ContentRoute =
  | "ignore"
  | "new_commitment"
  | "fulfillment"
  | "deadline_change"
  | "cancellation"
  | "context_update";

export type InboundEvent = {
  id: string;
  userId: string;
  provider: string;
  sourceType: string;
  externalId: string;
  occurredAt: string;
  actor?: string;
  content?: string;
  metadata: Record<string, unknown>;
};

export type LiveStatus =
  | "NOT_CONNECTED"
  | "CONNECTING"
  | "CONNECTED"
  | "SYNCING"
  | "LIVE"
  | "DEGRADED"
  | "AUTH_EXPIRED"
  | "ERROR"
  | "DISCONNECTED"
  | "NOT_YET_CONFIGURED";

export type ConnectorCapabilities = {
  read: boolean;
  write: boolean;
  realtime: boolean;
  notifications: boolean;
  search: boolean;
};

export type LiveFeedEvent = {
  id: string;
  at: string;
  provider: string;
  summary: string;
  status: string;
  route: string | null;
};

export type LiveNow = {
  listening: { provider: string; live: LiveStatus }[];
  analyzing: number;
  checking: number;
  watchingDeadlines: number;
  waiting: number;
  line: string;
  events: LiveFeedEvent[];
};
