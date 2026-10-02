import { extractionSchema } from "@/lib/agents/extract";
import type { Extraction } from "@/lib/agents/extract";
import {
  GUEST_MAX_THREADS,
  GUEST_TTL_MS,
  type GuestDraft,
  type GuestSourceKind,
  type GuestThread,
  type GuestThreadStatus,
  type GuestWorkspace,
} from "@/lib/guest/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseSourceKind(value: unknown): GuestSourceKind {
  if (value === "VOICE" || value === "PASTE" || value === "TEXT") return value;
  return "TEXT";
}

function parseStatus(value: unknown): GuestThreadStatus {
  if (value === "POSTPONED" || value === "DISMISSED" || value === "RESOLVED" || value === "OPEN") {
    return value;
  }
  return "OPEN";
}

export function emptyGuestWorkspace(now = new Date()): GuestWorkspace {
  const stamp = now.toISOString();
  return {
    version: 1,
    createdAt: stamp,
    updatedAt: stamp,
    threads: [],
    openedAny: false,
    postponedAny: false,
  };
}

export function parseGuestThread(value: unknown): GuestThread | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string" || !value.id.startsWith("g_")) return null;
  if (typeof value.note !== "string" || value.note.trim().length < 8) return null;
  if (typeof value.title !== "string" || !value.title.trim()) return null;
  if (typeof value.createdAt !== "string") return null;
  return {
    id: value.id,
    note: value.note.trim(),
    title: value.title.trim(),
    person: typeof value.person === "string" && value.person.trim() ? value.person.trim() : null,
    deadline: typeof value.deadline === "string" ? value.deadline : null,
    dueAt: typeof value.dueAt === "string" ? value.dueAt : null,
    evidence: typeof value.evidence === "string" && value.evidence.trim() ? value.evidence.trim() : value.note.trim(),
    confidence: typeof value.confidence === "number" ? value.confidence : 0,
    uncertain: Boolean(value.uncertain),
    isCommitment: Boolean(value.isCommitment),
    sourceKind: parseSourceKind(value.sourceKind),
    status: parseStatus(value.status),
    createdAt: value.createdAt,
    postponedUntil: typeof value.postponedUntil === "string" ? value.postponedUntil : null,
    resolvedAt: typeof value.resolvedAt === "string" ? value.resolvedAt : null,
  };
}

export function parseGuestWorkspace(value: unknown, now = new Date()): GuestWorkspace | null {
  if (!isRecord(value) || value.version !== 1) return null;
  if (typeof value.updatedAt !== "string") return null;
  const updated = Date.parse(value.updatedAt);
  if (!Number.isFinite(updated) || now.getTime() - updated > GUEST_TTL_MS) return null;
  const threads = Array.isArray(value.threads)
    ? value.threads.map(parseGuestThread).filter((item): item is GuestThread => Boolean(item))
    : [];
  return {
    version: 1,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : value.updatedAt,
    updatedAt: value.updatedAt,
    threads: threads.slice(0, GUEST_MAX_THREADS),
    openedAny: Boolean(value.openedAny),
    postponedAny: Boolean(value.postponedAny),
  };
}

export function parseGuestDraft(value: unknown): GuestDraft | null {
  if (!isRecord(value) || typeof value.note !== "string" || value.note.trim().length < 8) return null;
  const extraction = value.extraction ? extractionSchema.safeParse(value.extraction) : null;
  return {
    note: value.note.trim(),
    extraction: extraction?.success ? extraction.data : undefined,
  };
}

export function threadFromExtraction(
  note: string,
  extraction: Extraction,
  sourceKind: GuestSourceKind,
): GuestThread {
  return {
    id: `g_${crypto.randomUUID()}`,
    note: note.trim(),
    title: extraction.normalized_commitment || extraction.commitment_text,
    person: extraction.person,
    deadline: extraction.deadline,
    dueAt: extraction.due_at,
    evidence: extraction.evidence || note.trim(),
    confidence: extraction.confidence,
    isCommitment: extraction.is_commitment,
    uncertain: extraction.uncertain,
    sourceKind,
    status: "OPEN",
    createdAt: new Date().toISOString(),
    postponedUntil: null,
    resolvedAt: null,
  };
}

export function displayTitle(title: string) {
  return title.replace(/\s+/g, " ").trim().toUpperCase();
}
