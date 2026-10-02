import { runRedTeamAgent } from "@/lib/agents/governance";

export type PostponeAdvice = {
  count: number;
  kind: "MOVE_DEADLINE" | "SMALLER_STEP" | "MICRO_ACTION";
  prompt: string;
  suggestedAction: string;
  proposalKind: "MOVE_DEADLINE" | "MICRO_ACTION" | "NONE";
};

export function evaluatePostponement(currentCount: number): PostponeAdvice {
  const count = currentCount + 1;
  if (count <= 1) {
    return {
      count,
      kind: "MOVE_DEADLINE",
      prompt: "When instead?",
      suggestedAction: "Choose another time, if this still matters.",
      proposalKind: "MOVE_DEADLINE",
    };
  }
  if (count === 2) {
    return {
      count,
      kind: "SMALLER_STEP",
      prompt: "You've moved this twice. Want to make the next step smaller?",
      suggestedAction: "Make the next step smaller instead of moving the whole thing again.",
      proposalKind: "NONE",
    };
  }
  return {
    count,
    kind: "MICRO_ACTION",
    prompt: "Open the document and write the first three lines.",
    suggestedAction: "Open the document and write the first three lines.",
    proposalKind: "MICRO_ACTION",
  };
}

export type InterventionAdvice = {
  intervene: boolean;
  reason: string;
  suggestedAction: string;
  confidence: number;
  requiresApproval: true;
  status: "APPROACHING" | "POSTPONED" | "OPEN" | "QUIET";
};

export function evaluateIntervention(input: {
  dueAt: Date | null;
  postponementCount: number;
  calendarConnected: boolean;
  hasConflict: boolean;
  latestEvidence: string;
  now?: Date;
}): InterventionAdvice {
  const now = input.now ?? new Date();
  const hours = input.dueAt ? (input.dueAt.getTime() - now.getTime()) / 3_600_000 : null;
  const approaching = hours !== null && hours > 0 && hours <= 24;
  const overdue = hours !== null && hours <= 0;

  if (input.postponementCount >= 2) {
    return {
      intervene: true,
      reason: "Repeated postponement. The original deadline has already moved.",
      suggestedAction: evaluatePostponement(input.postponementCount - 1).suggestedAction,
      confidence: 0.74,
      requiresApproval: true,
      status: "POSTPONED",
    };
  }

  if (approaching || overdue) {
    const conflictNote =
      input.hasConflict && input.calendarConnected
        ? " A calendar conflict is in the way."
        : input.hasConflict && !input.calendarConnected
          ? " Connect Google Calendar to let STILL reason about schedule conflicts."
          : "";
    return {
      intervene: true,
      reason: overdue
        ? `The named time has passed.${conflictNote}`
        : `The named time is close.${conflictNote}`,
      suggestedAction: input.hasConflict
        ? "Move the flexible event instead?"
        : "Do the thing, or say if it should move.",
      confidence: 0.7,
      requiresApproval: true,
      status: "APPROACHING",
    };
  }

  return {
    intervene: false,
    reason: "No interruption is needed yet.",
    suggestedAction: "Leave it until the time gets closer.",
    confidence: 0.4,
    requiresApproval: true,
    status: "QUIET",
  };
}

export function redTeamExternalAction(input: {
  proposal: string;
  evidence: string;
  stillActive: boolean;
  target?: string;
}) {
  const target = `${input.proposal} ${input.target ?? ""}`;
  return runRedTeamAgent({
    proposal: target,
    evidence: input.evidence,
    stillActive: input.stillActive,
  }).output;
}

export function nextDeadlineFrom(dueAt: Date | null, now = new Date()) {
  const base = dueAt && dueAt.getTime() > now.getTime() ? dueAt : now;
  const next = new Date(base);
  next.setDate(next.getDate() + 1);
  next.setHours(18, 0, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}
