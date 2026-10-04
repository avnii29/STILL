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
  if (count === 3) {
    return {
      count,
      kind: "MICRO_ACTION",
      prompt: "Open the document and write the first three lines.",
      suggestedAction: "Open the document and write the first three lines.",
      proposalKind: "MICRO_ACTION",
    };
  }
  return {
    count,
    kind: "MICRO_ACTION",
    prompt: "You've moved this enough times that it may no longer be real. Keep it, change it, or let it go?",
    suggestedAction: "Keep the commitment, change the deadline, or let it go.",
    proposalKind: "NONE",
  };
}

export type DayEvent = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  calendarId: string;
  source: "google" | "local";
  priority?: string;
};

export type ProposedMove = {
  eventId: string;
  calendarId: string;
  title: string;
  source: "google" | "local";
  priority?: string;
  fromStart: string;
  fromEnd: string;
  start: string;
  end: string;
};

export type InterventionAdvice = {
  intervene: boolean;
  reason: string;
  suggestedAction: string;
  confidence: number;
  requiresApproval: true;
  status: "APPROACHING" | "POSTPONED" | "OPEN" | "QUIET";
  proposedMove: ProposedMove | null;
};

export function evaluateIntervention(input: {
  dueAt: Date | null;
  postponementCount: number;
  calendarConnected: boolean;
  hasConflict: boolean;
  latestEvidence: string;
  now?: Date;
  events?: DayEvent[];
}): InterventionAdvice {
  const now = input.now ?? new Date();
  const hours = input.dueAt ? (input.dueAt.getTime() - now.getTime()) / 3_600_000 : null;
  const approaching = hours !== null && hours > 0 && hours <= 24;
  const overdue = hours !== null && hours <= 0;
  const sameDay = (input.events ?? []).filter((event) => sameLocalDay(event.startsAt, input.dueAt ?? now));
  const proposedMove =
    input.postponementCount >= 1 ? nearbyMove(sameDay, input.dueAt) : null;

  if (proposedMove && (input.postponementCount === 1 || input.postponementCount >= 2)) {
    const from = new Date(proposedMove.fromStart);
    const to = new Date(proposedMove.start);
    return {
      intervene: true,
      reason: `${proposedMove.title} is on the same day. Move it from ${clock(from)} to ${clock(to)} instead of pushing the commitment.`,
      suggestedAction: `Move ${proposedMove.title} to ${clock(to)}. Nothing moves until you approve.`,
      confidence: 0.74,
      requiresApproval: true,
      status: "POSTPONED",
      proposedMove,
    };
  }

  if (input.postponementCount >= 2) {
    return {
      intervene: true,
      reason: "Repeated postponement. The original deadline has already moved.",
      suggestedAction: evaluatePostponement(input.postponementCount - 1).suggestedAction,
      confidence: 0.74,
      requiresApproval: true,
      status: "POSTPONED",
      proposedMove: null,
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
      proposedMove: null,
    };
  }

  return {
    intervene: false,
    reason: "No interruption is needed yet.",
    suggestedAction: "Leave it until the time gets closer.",
    confidence: 0.4,
    requiresApproval: true,
    status: "QUIET",
    proposedMove: null,
  };
}

function sameLocalDay(iso: string, day: Date) {
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) return false;
  return (
    value.getFullYear() === day.getFullYear() &&
    value.getMonth() === day.getMonth() &&
    value.getDate() === day.getDate()
  );
}

function clock(value: Date) {
  return value.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

function nearbyMove(events: DayEvent[], dueAt: Date | null): ProposedMove | null {
  const candidates = events
    .filter((event) => {
      const start = Date.parse(event.startsAt);
      const end = Date.parse(event.endsAt);
      return Number.isFinite(start) && Number.isFinite(end) && end > start;
    })
    .sort((left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt));
  const preferred = dueAt
    ? candidates.filter((event) => Date.parse(event.startsAt) < dueAt.getTime())
    : candidates;
  const event = (preferred.length > 0 ? preferred : candidates)[0];
  if (!event) return null;
  const start = new Date(event.startsAt);
  const end = new Date(event.endsAt);
  const duration = end.getTime() - start.getTime();
  for (const minutes of [60, 90, 120, 180]) {
    const nextStart = new Date(start.getTime() + minutes * 60_000);
    const nextEnd = new Date(nextStart.getTime() + duration);
    if (!sameLocalDay(nextStart.toISOString(), start)) continue;
    const clash = candidates.some((other) => {
      if (other.id === event.id) return false;
      const otherStart = Date.parse(other.startsAt);
      const otherEnd = Date.parse(other.endsAt);
      return nextStart.getTime() < otherEnd && nextEnd.getTime() > otherStart;
    });
    if (clash) continue;
    return {
      eventId: event.id,
      calendarId: event.calendarId,
      title: event.title,
      source: event.source,
      priority: event.priority,
      fromStart: event.startsAt,
      fromEnd: event.endsAt,
      start: nextStart.toISOString(),
      end: nextEnd.toISOString(),
    };
  }
  return null;
}

export function redTeamExternalAction(input: {
  proposal: string;
  evidence: string;
  stillActive: boolean;
  target?: string;
  eventTitle?: string;
  priority?: string;
}) {
  const target = `${input.proposal} ${input.target ?? ""}`;
  return runRedTeamAgent({
    proposal: target,
    evidence: input.evidence,
    stillActive: input.stillActive,
    eventTitle: input.eventTitle,
    priority: input.priority,
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
