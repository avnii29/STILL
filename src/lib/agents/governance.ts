import type { AgentEnvelope, AgentMessage, DetectionResult } from "@/lib/agents/types";
import { detectCommitmentHeuristic } from "@/lib/agents/commitment-detector";
import { logger } from "@/lib/logger";

export function runRouterAgent(message: AgentMessage): AgentEnvelope<"detect" | "ignore"> {
  const hit = detectCommitmentHeuristic(message);
  const route = hit ? "detect" : "ignore";
  const result = {
    name: "RouterAgent",
    ok: true,
    confidence: hit?.confidence ?? 0.1,
    output: route as "detect" | "ignore",
    evidenceRefs: [message.body],
  };
  logger.info("agent.router", { route, confidence: result.confidence });
  return result;
}

export function runEvidenceAgent(detection: DetectionResult): AgentEnvelope<DetectionResult> {
  const result = {
    name: "EvidenceAgent",
    ok: Boolean(detection.evidence),
    confidence: detection.confidence,
    output: detection,
    evidenceRefs: [detection.evidence],
    error: detection.evidence ? undefined : "No evidence text.",
  };
  logger.info("agent.evidence", { ok: result.ok, length: detection.evidence.length });
  return result;
}

export function runPriorityAgent(detection: DetectionResult): AgentEnvelope<"now" | "later" | "quiet"> {
  const soon = /\b(tonight|today|tomorrow|this (morning|afternoon|evening))\b/i.test(
    detection.evidence,
  );
  const output = !detection.is_thread ? "quiet" : soon ? "now" : "later";
  logger.info("agent.priority", { output });
  return {
    name: "PriorityAgent",
    ok: true,
    confidence: detection.confidence,
    output,
    evidenceRefs: [detection.evidence],
  };
}

export function runThreadAgent(detection: DetectionResult): AgentEnvelope<string> {
  const body = `${detection.type} · ${detection.owner} · ${detection.current_state}`;
  logger.info("agent.thread", { type: detection.type });
  return {
    name: "ThreadAgent",
    ok: true,
    confidence: detection.confidence,
    output: body,
    evidenceRefs: [detection.evidence],
  };
}

export function runInterventionAgent(input: {
  detection: DetectionResult;
  postponeCount?: number;
}): AgentEnvelope<{
  necessary: boolean;
  why: string;
  evidence: string;
  proposedAction: string;
  requiresConfirmation: true;
}> {
  const overdue = /\b(tonight|tomorrow|today)\b/i.test(input.detection.evidence);
  const necessary = input.detection.is_thread && overdue;
  const output = {
    necessary,
    why: necessary
      ? "A time was named, and the commitment is still unfinished."
      : "No interruption is needed yet.",
    evidence: input.detection.evidence,
    proposedAction: input.detection.suggested_action,
    requiresConfirmation: true as const,
  };
  logger.info("agent.intervention", { necessary });
  return {
    name: "InterventionAgent",
    ok: true,
    confidence: input.detection.confidence,
    output,
    evidenceRefs: [input.detection.evidence],
  };
}

export function runFrictionAgent(postponeCount: number, evidence: string): AgentEnvelope<{
  postponeCount: number;
  smallerAction: string | null;
}> {
  const smaller =
    postponeCount >= 2
      ? "Open the document and write the first three lines."
      : null;
  logger.info("agent.friction", { postponeCount, smaller: Boolean(smaller) });
  return {
    name: "FrictionAgent",
    ok: true,
    confidence: postponeCount >= 2 ? 0.7 : 0.4,
    output: { postponeCount, smallerAction: smaller },
    evidenceRefs: [evidence],
  };
}

export function runRedTeamAgent(input: {
  proposal: string;
  evidence: string;
  stillActive: boolean;
}): AgentEnvelope<{
  allowed: boolean;
  blockedReason?: string;
  checks: string[];
}> {
  const interview = /interview/i.test(input.proposal) || /interview/i.test(input.evidence);
  const checks = [
    "evidence current",
    "commitment still active",
    "target identity",
    "reversible",
    "another person affected",
    "unexpected consequence",
  ];
  const allowed = input.stillActive && !interview;
  const output = {
    allowed,
    blockedReason: interview
      ? "This event contains an interview link."
      : input.stillActive
        ? undefined
        : "The commitment is no longer active.",
    checks,
  };
  logger.info("agent.redteam", { allowed, blockedReason: output.blockedReason });
  return {
    name: "RedTeamAgent",
    ok: true,
    confidence: allowed ? 0.62 : 0.9,
    output,
    evidenceRefs: [input.evidence],
  };
}

export function runActionProposalAgent(input: {
  kind: "MOVE_CALENDAR_EVENT" | "OPEN_DOCUMENT" | "NONE";
  target: string;
  reason: string;
}): AgentEnvelope<{
  kind: "MOVE_CALENDAR_EVENT" | "OPEN_DOCUMENT" | "NONE";
  target: string;
  reason: string;
  risk: "low" | "medium" | "high";
  externalConsequence: string;
  reversible: boolean;
  affectsAnotherPerson: boolean;
  requiresUserApproval: true;
}> {
  const output = {
    kind: input.kind,
    target: input.target,
    reason: input.reason,
    risk: input.kind === "NONE" ? ("low" as const) : ("medium" as const),
    externalConsequence:
      input.kind === "MOVE_CALENDAR_EVENT"
        ? "Calendar changes"
        : input.kind === "OPEN_DOCUMENT"
          ? "A document would open"
          : "No external change",
    reversible: input.kind !== "MOVE_CALENDAR_EVENT",
    affectsAnotherPerson: input.kind === "MOVE_CALENDAR_EVENT",
    requiresUserApproval: true as const,
  };
  logger.info("agent.actionProposal", { kind: output.kind, risk: output.risk });
  return {
    name: "ActionProposalAgent",
    ok: true,
    confidence: 0.8,
    output,
    evidenceRefs: [input.target],
  };
}
