import { extractPerson } from "@/lib/agents/extract";
import { runDeadlineAgent } from "@/lib/agents/deadline-agent";
import { runEvidenceAgent, runRedTeamAgent } from "@/lib/agents/governance";
import type { DetectionResult } from "@/lib/agents/types";
import { gateAction, type GateResult } from "@/lib/actions/gateway";
import { routeContent, shouldInterrupt } from "@/lib/ingestion/router";
import { overlapsCommitment } from "@/lib/ingestion/normalizer";
import { detectCommitment } from "@/lib/sources/detect";
import { evaluateIntervention } from "@/lib/threads/lifecycle";

export type AgentStep = {
  agent: string;
  ok: boolean;
  decision: string;
  confidence: number;
  evidence: string[];
  risk?: "low" | "medium" | "high";
};

export type LoopCalendarEvent = {
  title: string;
  startsAt: string;
  endsAt: string;
  important?: boolean;
};

export type StillLoopResult = {
  steps: AgentStep[];
  commitment: {
    text: string;
    person: string | null;
    dueAt: string | null;
    dueText: string | null;
    precision: string;
    confidence: number;
    evidence: string;
  } | null;
  proposal: {
    title: string;
    reason: string;
    risk: "medium";
    important: boolean;
  } | null;
  intervention: { intervene: boolean; reason: string };
  gate: GateResult | null;
  deadlineChange: { from: string; to: string } | null;
};

function step(agent: string, ok: boolean, decision: string, confidence: number, evidence: string): AgentStep {
  return { agent, ok, decision, confidence, evidence: evidence ? [evidence] : [] };
}

function localDay(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function runStillLoop(input: {
  text: string;
  now?: Date;
  timeZone?: string;
  calendarEvents?: LoopCalendarEvent[];
  calendarConnected?: boolean;
  approved?: boolean;
  knownDueAt?: string | null;
}): StillLoopResult {
  const timeZone = input.timeZone || "UTC";
  const now = input.now ?? new Date();
  const text = input.text.replace(/\s+/g, " ").trim();
  const route = routeContent(text);
  const steps: AgentStep[] = [
    step("Router", true, route === "ignore" ? "ignore" : route, route === "ignore" ? 0.2 : 0.8, text.slice(0, 180)),
  ];

  if (route === "deadline_change") {
    const deadline = runDeadlineAgent({ text, now, timeZone });
    steps.push(
      step(
        "Deadline",
        Boolean(deadline.dueAt),
        deadline.dueAt ? `${deadline.dueText} · ${deadline.precision}` : "No hard deadline",
        deadline.confidence,
        text.slice(0, 180),
      ),
    );
    steps.push(
      step("Resolution", true, "deadline_changed", deadline.confidence, text.slice(0, 180)),
      step("Intervention", true, "no_action_needed", 0.8, "The deadline moved. No interruption."),
    );
    return {
      steps,
      commitment: null,
      proposal: null,
      intervention: { intervene: false, reason: "The deadline moved. No interruption." },
      gate: null,
      deadlineChange: deadline.dueText ? { from: "previous", to: deadline.dueText } : null,
    };
  }

  const detection = detectCommitment({ text, now, timeZone });
  const isCommitment = detection.classification === "COMMITMENT" || detection.classification === "REMINDER_REQUEST";
  steps.push(
    step(
      "Commitment",
      isCommitment,
      detection.classification.toLowerCase(),
      detection.confidence,
      detection.evidence_span,
    ),
  );

  if (!isCommitment && detection.classification !== "POSSIBLE_COMMITMENT") {
    steps.push(step("Intervention", true, "no_action_needed", 0.9, shouldInterrupt(route).reason));
    return {
      steps,
      commitment: null,
      proposal: null,
      intervention: { intervene: false, reason: "No commitment to track." },
      gate: null,
      deadlineChange: null,
    };
  }

  const person = detection.target_person ?? extractPerson(text);
  const deadline = input.knownDueAt
    ? {
        dueAt: input.knownDueAt,
        dueText: "Tuesday evening",
        precision: "DAY_PART" as const,
        confidence: 0.78,
        askUser: false,
      }
    : runDeadlineAgent({ text, now, timeZone });
  const evidenceOk = text.includes(detection.evidence_span);
  const synthetic: DetectionResult = {
    is_thread: isCommitment,
    confidence: detection.confidence,
    type: detection.classification === "REMINDER_REQUEST" ? "REMINDER_REQUEST" : "EXPLICIT_PROMISE",
    evidence: detection.evidence_span,
    context: person ? `Retrieved because: person ${person}` : "No extra person was named.",
    current_state: "unfinished",
    suggested_action: "Leave it until the time gets closer.",
    needs_user_review: detection.classification === "POSSIBLE_COMMITMENT",
    title: detection.normalized_commitment,
    owner: "ME",
    meta: { interpretedBy: "heuristic", provider: "none" },
  };
  const evidenced = runEvidenceAgent(synthetic);
  steps.push(
    step("Context", true, synthetic.context, 0.7, detection.evidence_span),
    step("Evidence", evidenced.ok && evidenceOk, evidenceOk ? "source verified" : "quote missing from source", detection.confidence, detection.evidence_span),
    step(
      "Deadline",
      true,
      deadline.dueAt ? `${deadline.dueText} · ${deadline.precision}` : "No hard deadline",
      deadline.confidence,
      deadline.dueText ?? "none",
    ),
  );

  const dueAt = deadline.dueAt ? new Date(deadline.dueAt) : null;
  const conflict = (input.calendarEvents ?? []).find((event) => {
    if (!dueAt) return false;
    const starts = new Date(event.startsAt);
    const ends = new Date(event.endsAt);
    if (Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime())) return false;
    const sameDay = localDay(starts, timeZone) === localDay(dueAt, timeZone);
    return sameDay && (overlapsCommitment({ dueAt, startsAt: starts, endsAt: ends }) || starts.getTime() < dueAt.getTime());
  });
  const advice = evaluateIntervention({
    dueAt,
    postponementCount: 0,
    calendarConnected: Boolean(input.calendarConnected),
    hasConflict: Boolean(conflict),
    latestEvidence: detection.evidence_span,
    now,
  });
  steps.push(
    step(
      "Intervention",
      true,
      advice.intervene ? advice.reason : "no_action_needed",
      advice.confidence,
      detection.evidence_span,
    ),
  );

  let proposal: StillLoopResult["proposal"] = null;
  let gate: GateResult | null = null;
  if (conflict && advice.intervene) {
    proposal = {
      title: conflict.title,
      reason: `${conflict.title} is on the same day as this commitment.`,
      risk: "medium",
      important: Boolean(conflict.important),
    };
    const redTeam = runRedTeamAgent({
      proposal: conflict.title,
      evidence: detection.evidence_span,
      stillActive: true,
    });
    steps.push(
      step(
        "Red team",
        redTeam.output.allowed && !conflict.important,
        conflict.important ? "blocked_important_event" : redTeam.output.allowed ? "passed" : "blocked",
        redTeam.confidence,
        detection.evidence_span,
      ),
    );
    gate = gateAction({
      kind: "RESCHEDULE_CALENDAR_EVENT",
      evidence: detection.evidence_span,
      stillActive: true,
      approved: Boolean(input.approved),
      importantEvent: conflict.important,
      connectorReady: Boolean(input.calendarConnected),
    });
    steps.push(step("Human approval", gate.status === "READY", gate.status.toLowerCase(), advice.confidence, gate.reason));
  } else {
    steps.push(step("Red team", true, "no external action", 0.8, "Nothing external was proposed."));
  }

  return {
    steps,
    commitment: {
      text: detection.normalized_commitment,
      person,
      dueAt: deadline.dueAt,
      dueText: deadline.dueText,
      precision: deadline.precision,
      confidence: detection.confidence,
      evidence: detection.evidence_span,
    },
    proposal,
    intervention: { intervene: advice.intervene, reason: advice.reason },
    gate,
    deadlineChange: null,
  };
}
