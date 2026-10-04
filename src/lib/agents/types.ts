import type { ThreadDetection } from "@/lib/validation/schemas";

export type AgentMessage = {
  speaker: string;
  body: string;
  isFromUser: boolean;
};

export type ConversationSlice = {
  messages: AgentMessage[];
  focusIndex: number;
  personName?: string;
};

export type JsonSchemaHint = Record<string, unknown>;

export type LanguageModel = {
  id: string;
  provider: string;
  completeJson<T>(input: {
    system: string;
    user: string;
    schemaName: string;
  }): Promise<T>;
};

export type AgentMeta = {
  interpretedBy: string;
  provider: string;
  model?: string;
};

export type DetectionResult = ThreadDetection & {
  title: string;
  owner: "ME" | "THEM" | "SHARED" | "SELF";
  personName?: string;
  suggestedFollowUpAt?: string | null;
  normalizedCommitment?: string;
  deadlineConfidence?: number;
  uncertain?: boolean;
  meta: AgentMeta;
  extraction?: import("@/lib/agents/extract").Extraction;
};

export type ResolutionLook = {
  likelyResolved: boolean;
  kind?: "FULFILLED" | "SUPERSEDED" | "CANCELLED" | "IRRELEVANT" | "EXPIRED";
  evidence: string;
  uncertainty: string;
};

export type SocialAdvice = {
  shouldSurface: boolean;
  reason: string;
  caution: string;
};

export type Suggestion = {
  action: string;
  requiresUserApproval: boolean;
  wouldContactAnotherHuman: boolean;
};

export type AgentEnvelope<T> = {
  name: string;
  ok: boolean;
  confidence: number;
  output: T;
  evidenceRefs: string[];
  error?: string;
};

export type ActionProposal = {
  kind: "MOVE_CALENDAR_EVENT" | "OPEN_DOCUMENT" | "NONE";
  target: string;
  reason: string;
  risk: "low" | "medium" | "high";
  externalConsequence: string;
  reversible: boolean;
  affectsAnotherPerson: boolean;
  requiresUserApproval: true;
};

export type RedTeamVerdict = {
  allowed: boolean;
  blockedReason?: string;
  checks: string[];
};

export type InterventionDecision = {
  necessary: boolean;
  why: string;
  evidence: string;
  proposedAction: string;
  requiresConfirmation: true;
};

export type FrictionSuggestion = {
  postponeCount: number;
  smallerAction: string | null;
};
