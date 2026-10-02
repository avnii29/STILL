import type { Extraction } from "@/lib/agents/extract";

export const GUEST_DB_NAME = "still-guest";
export const GUEST_DB_VERSION = 1;
export const GUEST_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const GUEST_MAX_THREADS = 12;
export const LEGACY_STORAGE_KEY = "still-guest-v1";

export type GuestSourceKind = "TEXT" | "VOICE" | "PASTE";
export type GuestThreadStatus = "OPEN" | "POSTPONED" | "RESOLVED" | "DISMISSED";
export type GuestStorageMode = "indexeddb" | "memory" | "none";

export type GuestThread = {
  id: string;
  note: string;
  title: string;
  person: string | null;
  deadline: string | null;
  dueAt: string | null;
  evidence: string;
  confidence: number;
  uncertain: boolean;
  isCommitment: boolean;
  sourceKind: GuestSourceKind;
  status: GuestThreadStatus;
  createdAt: string;
  postponedUntil: string | null;
  resolvedAt: string | null;
};

export type GuestMeta = {
  createdAt: string;
  updatedAt: string;
  skipMigration: boolean;
};

export type GuestDraft = {
  note: string;
  extraction?: Extraction;
};

export type GuestWorkspace = {
  version: 1;
  createdAt: string;
  updatedAt: string;
  threads: GuestThread[];
  openedAny: boolean;
  postponedAny: boolean;
};
