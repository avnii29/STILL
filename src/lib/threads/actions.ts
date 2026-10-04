import "server-only";

import type { Prisma, ThreadStatus } from "@/generated/prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { getPrisma } from "@/lib/prisma";
import { NO_AUTO_MESSAGE } from "@/lib/copy";
import type { AppUser } from "@/lib/auth";
import {
  evaluateIntervention,
  evaluatePostponement,
  nextDeadlineFrom,
  redTeamExternalAction,
} from "@/lib/threads/lifecycle";
import { calendarStatus, docsStatus } from "@/lib/integrations/google";
import { executeCalendarMove, listCalendarEvents } from "@/lib/connectors/google-calendar-sync";
import { scheduleRemindAt } from "@/lib/agents/extract";

const ACTION_STATUS: Record<string, ThreadStatus> = {
  open: "OPEN",
  wait_on_me: "WAITING_ON_ME",
  wait_on_them: "WAITING_ON_THEM",
  expire: "EXPIRED",
};

export async function applyThreadAction(input: {
  user: AppUser;
  threadId: string;
  action:
    | "open"
    | "wait_on_me"
    | "wait_on_them"
    | "resolve"
    | "dismiss"
    | "expire"
    | "approve_suggestion"
    | "postpone"
    | "approve_proposal"
    | "reject_proposal"
    | "edit_proposal"
    | "delete";
  resolutionKind?:
    | "FULFILLED"
    | "SUPERSEDED"
    | "CANCELLED"
    | "IRRELEVANT"
    | "EXPIRED"
    | "USER_DISMISSED";
  note?: string;
  proposalId?: string;
  when?: string;
}) {
  const prisma = getPrisma();
  const thread = await prisma.thread.findFirst({
    where: { id: input.threadId, userId: input.user.id },
    include: {
      reminders: { where: { status: "SCHEDULED" } },
      actionProposals: { where: { status: "PENDING" }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!thread) return null;

  if (input.action === "postpone") {
    return postponeThread({ user: input.user, thread, when: input.when });
  }

  if (input.action === "edit_proposal") {
    return editProposal({
      user: input.user,
      threadId: thread.id,
      proposalId: input.proposalId ?? thread.actionProposals[0]?.id,
      when: input.when,
    });
  }

  if (input.action === "approve_proposal" || input.action === "reject_proposal") {
    return decideProposal({
      user: input.user,
      thread,
      proposalId: input.proposalId ?? thread.actionProposals[0]?.id,
      approve: input.action === "approve_proposal",
      note: input.note,
    });
  }

  if (input.action === "approve_suggestion") {
    await writeAuditLog({
      userId: input.user.id,
      action: "SOCIAL_ACTION_APPROVED",
      target: thread.id,
      metadata: { blockedSend: true },
    });
    await prisma.threadEvent.create({
      data: {
        userId: input.user.id,
        threadId: thread.id,
        kind: "SUGGESTION_APPROVED",
        body: `${thread.suggestedNextAction}\n\n${NO_AUTO_MESSAGE}`,
      },
    });
    await prisma.thread.update({
      where: { id: thread.id },
      data: {
        status: thread.owner === "ME" || thread.owner === "SELF" ? "WAITING_ON_ME" : "WAITING_ON_THEM",
        needsUserReview: false,
      },
    });
    return { ok: true as const, sent: false, message: NO_AUTO_MESSAGE };
  }

  if (input.action === "resolve" || input.action === "dismiss") {
    const kind =
      input.action === "dismiss"
        ? "USER_DISMISSED"
        : (input.resolutionKind ?? "FULFILLED");
    await prisma.resolution.upsert({
      where: { threadId: thread.id },
      update: { kind, note: input.note },
      create: {
        userId: input.user.id,
        threadId: thread.id,
        kind,
        note: input.note,
      },
    });
    await prisma.thread.update({
      where: { id: thread.id },
      data: {
        status: input.action === "dismiss" ? "DISMISSED" : "RESOLVED",
        resolvedAt: new Date(),
        resolutionReason: input.note ?? kind,
        needsUserReview: false,
        events: {
          create: {
            userId: input.user.id,
            kind: input.action === "dismiss" ? "DISMISSED" : "RESOLVED",
            body: input.note ?? kind,
          },
        },
      },
    });
    await prisma.reminder.updateMany({
      where: { threadId: thread.id, status: "SCHEDULED" },
      data: { status: "CANCELLED" },
    });
    await writeAuditLog({
      userId: input.user.id,
      action: input.action === "dismiss" ? "THREAD_DISMISSED" : "THREAD_RESOLVED",
      target: thread.id,
    });
    return { ok: true as const };
  }

  if (input.action === "delete") {
    await writeAuditLog({
      userId: input.user.id,
      action: "THREAD_DISMISSED",
      target: thread.id,
      metadata: { deleted: true },
    });
    await prisma.thread.delete({
      where: { id: thread.id },
    });
    return { ok: true as const, deleted: true };
  }

  const status = ACTION_STATUS[input.action];
  if (!status) return null;

  await prisma.thread.update({
    where: { id: thread.id },
    data: {
      status,
      needsUserReview: false,
      events: {
        create: {
          userId: input.user.id,
          kind: "STATUS_CHANGED",
          body: status,
        },
      },
    },
  });
  await writeAuditLog({
    userId: input.user.id,
    action: "THREAD_STATUS_CHANGED",
    target: thread.id,
    metadata: { status },
  });
  return { ok: true as const };
}

async function postponeThread(input: {
  user: AppUser;
  thread: {
    id: string;
    title: string;
    evidence: string;
    dueAt: Date | null;
    postponementCount: number;
    status: ThreadStatus;
  };
  when?: string;
}) {
  const prisma = getPrisma();
  const advice = evaluatePostponement(input.thread.postponementCount);
  const chosenDue = input.when ? new Date(input.when) : null;
  const calendar = calendarStatus(false);
  const day = input.thread.dueAt ?? new Date();
  const events = await listCalendarEvents({ userId: input.user.id, day });
  const intervention = evaluateIntervention({
    dueAt: input.thread.dueAt,
    postponementCount: advice.count,
    calendarConnected: calendar.connected,
    hasConflict: events.length > 0,
    latestEvidence: input.thread.evidence,
    events,
  });
  const move = intervention.proposedMove;
  const nextDue =
    chosenDue && !Number.isNaN(chosenDue.getTime()) ? chosenDue : nextDeadlineFrom(input.thread.dueAt);

  const interventionRow = await prisma.intervention.create({
    data: {
      userId: input.user.id,
      threadId: input.thread.id,
      reason: intervention.reason,
      suggestedAction: move ? intervention.suggestedAction : advice.suggestedAction,
      confidence: intervention.confidence,
      requiresApproval: true,
      status: "PENDING",
      metadata: { postpone: advice } as Prisma.InputJsonValue,
    },
  });

  const redTeam = redTeamExternalAction({
    proposal: move ? `MOVE ${move.title}` : advice.kind === "MOVE_DEADLINE" ? `MOVE DEADLINE ${input.thread.title}` : advice.suggestedAction,
    evidence: input.thread.evidence,
    stillActive: input.thread.status !== "RESOLVED" && input.thread.status !== "DISMISSED",
    eventTitle: move?.title,
    priority: move?.priority,
  });

  const proposalKind = move
    ? "MOVE_CALENDAR_EVENT"
    : advice.proposalKind === "MOVE_DEADLINE"
      ? "MOVE_DEADLINE"
      : advice.proposalKind === "MICRO_ACTION"
        ? "MICRO_ACTION"
        : "NONE";

  const proposal = await prisma.actionProposal.create({
    data: {
      userId: input.user.id,
      threadId: input.thread.id,
      interventionId: interventionRow.id,
      kind: proposalKind,
      target: move ? move.title : input.thread.title,
      reason: move ? intervention.reason : advice.prompt,
      risk: advice.count >= 3 ? "medium" : "low",
      status: redTeam.allowed ? "PENDING" : "BLOCKED",
      requiresApproval: true,
      blockedReason: redTeam.blockedReason,
      metadata: {
        calendar: calendar.message,
        docs: docsStatus(false).message,
        nextDue: nextDue.toISOString(),
        ...(move
          ? {
              calendarId: move.calendarId,
              eventId: move.eventId,
              start: move.start,
              end: move.end,
              source: move.source,
              fromStart: move.fromStart,
              fromEnd: move.fromEnd,
            }
          : {}),
      } as Prisma.InputJsonValue,
    },
  });

  await prisma.agentRun.createMany({
    data: [
      {
        userId: input.user.id,
        threadId: input.thread.id,
        kind: "POSTPONE",
        input: { count: advice.count } as Prisma.InputJsonValue,
        output: advice as Prisma.InputJsonValue,
        ok: true,
        confidence: 0.8,
        provider: "heuristic",
      },
      {
        userId: input.user.id,
        threadId: input.thread.id,
        kind: "INTERVENTION",
        input: { postponementCount: advice.count } as Prisma.InputJsonValue,
        output: intervention as Prisma.InputJsonValue,
        ok: true,
        confidence: intervention.confidence,
        provider: "heuristic",
      },
      {
        userId: input.user.id,
        threadId: input.thread.id,
        kind: "RED_TEAM",
        input: { proposal: proposal.kind } as Prisma.InputJsonValue,
        output: redTeam as Prisma.InputJsonValue,
        ok: redTeam.allowed,
        confidence: redTeam.allowed ? 0.62 : 0.9,
        provider: "heuristic",
      },
    ],
  });

  await prisma.thread.update({
    where: { id: input.thread.id },
    data: {
      postponementCount: advice.count,
      status: move ? input.thread.status : "POSTPONED",
      dueAt: move ? input.thread.dueAt : nextDue,
      suggestedFollowUpAt: move ? input.thread.dueAt : nextDue,
      currentState: move ? intervention.reason : advice.prompt,
      suggestedNextAction: move ? intervention.suggestedAction : advice.suggestedAction,
      events: {
        create: {
          userId: input.user.id,
          kind: move ? "INTERVENTION_PROPOSED" : "POSTPONED",
          body: move ? intervention.reason : advice.prompt,
          metadata: { count: advice.count, proposalId: proposal.id, moved: false } as Prisma.InputJsonValue,
        },
      },
    },
  });

  await writeAuditLog({
    userId: input.user.id,
    action: "COMMITMENT_POSTPONED",
    target: input.thread.id,
    metadata: { count: advice.count },
  });
  await writeAuditLog({
    userId: input.user.id,
    action: redTeam.allowed ? "ACTION_PROPOSED" : "ACTION_BLOCKED",
    target: proposal.id,
  });
  await writeAuditLog({
    userId: input.user.id,
    action: "INTERVENTION_CREATED",
    target: interventionRow.id,
  });

  return {
    ok: true as const,
    postponementCount: advice.count,
    prompt: advice.prompt,
    suggestedAction: advice.suggestedAction,
    proposalId: proposal.id,
    blocked: !redTeam.allowed,
    blockedReason: redTeam.blockedReason,
    calendar: calendar.message,
    message: redTeam.allowed
      ? move
        ? `${intervention.reason} Nothing has moved.`
        : advice.prompt
      : redTeam.blockedReason ?? "Still blocked this action.",
  };
}

export async function proposeThreadResolution(input: {
  userId: string;
  threadId: string;
  evidence: string;
  confidence: number;
  resolutionKind?: "FULFILLED" | "CANCELLED";
}) {
  const prisma = getPrisma();
  const existing = await prisma.actionProposal.findFirst({
    where: {
      userId: input.userId,
      threadId: input.threadId,
      kind: "RESOLVE_THREAD",
      status: "PENDING",
    },
  });
  if (existing) return { proposalId: existing.id, created: false as const };
  const quote = input.evidence.replace(/\s+/g, " ").trim().slice(0, 280);
  const proposal = await prisma.actionProposal.create({
    data: {
      userId: input.userId,
      threadId: input.threadId,
      kind: "RESOLVE_THREAD",
      target: input.threadId,
      reason: `This may be done. "${quote}" Confirm before it closes.`,
      risk: "low",
      status: "PENDING",
      requiresApproval: true,
      metadata: {
        evidence: quote,
        confidence: input.confidence,
        resolutionKind: input.resolutionKind ?? "FULFILLED",
      } as Prisma.InputJsonValue,
    },
  });
  await prisma.threadEvent.create({
    data: {
      userId: input.userId,
      threadId: input.threadId,
      kind: "RESOLUTION_PROPOSED",
      body: `Paused for approval.\n"${quote}"`,
      metadata: { proposalId: proposal.id, confidence: input.confidence } as Prisma.InputJsonValue,
    },
  });
  await prisma.agentRun.create({
    data: {
      userId: input.userId,
      threadId: input.threadId,
      kind: "RESOLUTION",
      input: { evidence: quote } as Prisma.InputJsonValue,
      output: { likelyResolved: true, confidence: input.confidence, paused: true } as Prisma.InputJsonValue,
      ok: true,
      confidence: input.confidence,
      provider: "heuristic",
    },
  });
  return { proposalId: proposal.id, created: true as const };
}

async function editProposal(input: {
  user: AppUser;
  threadId: string;
  proposalId?: string;
  when?: string;
}) {
  const prisma = getPrisma();
  if (!input.proposalId || !input.when) {
    return { ok: false as const, message: "Choose a time before editing the proposal." };
  }
  const when = new Date(input.when);
  if (Number.isNaN(when.getTime())) return { ok: false as const, message: "That time is not valid." };
  const proposal = await prisma.actionProposal.findFirst({
    where: { id: input.proposalId, userId: input.user.id, threadId: input.threadId, status: "PENDING" },
  });
  if (!proposal || proposal.kind !== "MOVE_CALENDAR_EVENT") {
    return { ok: false as const, message: "There is no calendar proposal to edit." };
  }
  const metadata = proposal.metadata;
  const current =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : null;
  const previousStart = typeof current?.start === "string" ? Date.parse(current.start) : NaN;
  const previousEnd = typeof current?.end === "string" ? Date.parse(current.end) : NaN;
  const duration =
    Number.isFinite(previousStart) && Number.isFinite(previousEnd) && previousEnd > previousStart
      ? previousEnd - previousStart
      : 30 * 60_000;
  const next = {
    ...(current ?? {}),
    start: when.toISOString(),
    end: new Date(when.getTime() + duration).toISOString(),
  };
  await prisma.actionProposal.update({
    where: { id: proposal.id },
    data: { metadata: next as Prisma.InputJsonValue },
  });
  await prisma.threadEvent.create({
    data: {
      userId: input.user.id,
      threadId: input.threadId,
      kind: "PROPOSAL_EDITED",
      body: "The proposed time was edited. Nothing has moved.",
    },
  });
  return { ok: true as const, message: "The proposed time was edited. Nothing has moved." };
}

async function decideProposal(input: {
  user: AppUser;
  thread: {
    id: string;
    title: string;
    dueAt: Date | null;
  };
  proposalId?: string;
  approve: boolean;
  note?: string;
}) {
  const prisma = getPrisma();
  if (!input.proposalId) return { ok: false as const, message: "There is no proposal waiting." };

  const proposal = await prisma.actionProposal.findFirst({
    where: { id: input.proposalId, userId: input.user.id, threadId: input.thread.id },
  });
  if (!proposal) return null;
  if (proposal.status === "BLOCKED") {
    return {
      ok: false as const,
      message: proposal.blockedReason ?? "This action was blocked.",
    };
  }

  await prisma.actionApproval.create({
    data: {
      userId: input.user.id,
      proposalId: proposal.id,
      decision: input.approve ? "APPROVE" : "REJECT",
      note: input.note,
    },
  });

  if (!input.approve) {
    await prisma.actionProposal.update({
      where: { id: proposal.id },
      data: { status: "REJECTED" },
    });
    await prisma.threadEvent.create({
      data: {
        userId: input.user.id,
        threadId: input.thread.id,
        kind: "PROPOSAL_REJECTED",
        body: input.note ?? proposal.reason,
      },
    });
    await writeAuditLog({
      userId: input.user.id,
      action: "ACTION_REJECTED",
      target: proposal.id,
    });
    return { ok: true as const, message: "Nothing was changed." };
  }

  if (proposal.kind === "RESOLVE_THREAD") {
    const metadata =
      proposal.metadata && typeof proposal.metadata === "object" && !Array.isArray(proposal.metadata)
        ? (proposal.metadata as Record<string, unknown>)
        : {};
    const quote = typeof metadata.evidence === "string" ? metadata.evidence : proposal.reason;
    const resolutionKind = metadata.resolutionKind === "CANCELLED" ? "CANCELLED" : "FULFILLED";
    await prisma.reminder.updateMany({
      where: { threadId: input.thread.id, status: "SCHEDULED" },
      data: { status: "CANCELLED" },
    });
    await prisma.resolution.upsert({
      where: { threadId: input.thread.id },
      create: {
        userId: input.user.id,
        threadId: input.thread.id,
        kind: resolutionKind,
        evidence: quote,
        note: "Confirmed by you.",
      },
      update: { kind: resolutionKind, evidence: quote, note: "Confirmed by you." },
    });
    await prisma.actionProposal.update({
      where: { id: proposal.id },
      data: { status: "APPROVED" },
    });
    await prisma.thread.update({
      where: { id: input.thread.id },
      data: {
        status: "RESOLVED",
        resolvedAt: new Date(),
        resolutionReason: quote,
        currentState: "Resolved with your approval.",
        needsUserReview: false,
        events: {
          create: {
            userId: input.user.id,
            kind: "RESOLVED",
            body: `Resolved with your approval.\n"${quote}"`,
          },
        },
      },
    });
    await writeAuditLog({
      userId: input.user.id,
      action: "THREAD_RESOLVED",
      target: input.thread.id,
    });
    return { ok: true as const, message: "Resolved. It will stop nagging." };
  }

  if (proposal.kind === "MOVE_CALENDAR_EVENT") {
    const moved = await executeCalendarMove({
      userId: input.user.id,
      metadata: proposal.metadata,
    });
    if (!moved.ok) {
      await prisma.actionProposal.update({
        where: { id: proposal.id },
        data: { status: "BLOCKED", blockedReason: moved.message },
      });
      await prisma.threadEvent.create({
        data: {
          userId: input.user.id,
          threadId: input.thread.id,
          kind: "ACTION_BLOCKED",
          body: moved.message,
        },
      });
      return { ok: false as const, message: moved.message };
    }
    await prisma.actionProposal.update({
      where: { id: proposal.id },
      data: { status: "APPROVED" },
    });
    await prisma.thread.update({
      where: { id: input.thread.id },
      data: {
        status: "CHANGED",
        currentState: moved.message,
        events: {
          create: {
            userId: input.user.id,
            kind: "CALENDAR_UPDATED",
            body: moved.message,
          },
        },
      },
    });
    await writeAuditLog({
      userId: input.user.id,
      action: "ACTION_APPROVED",
      target: proposal.id,
    });
    return { ok: true as const, message: moved.message };
  }

  if (proposal.kind === "OPEN_DOCUMENT") {
    const docs = docsStatus(false);
    await prisma.actionProposal.update({
      where: { id: proposal.id },
      data: { status: "BLOCKED", blockedReason: docs.message },
    });
    return { ok: false as const, message: docs.message };
  }

  let dueAt = input.thread.dueAt;
  if (proposal.kind === "MOVE_DEADLINE") {
    dueAt = nextDeadlineFrom(input.thread.dueAt);
    await prisma.reminder.updateMany({
      where: { threadId: input.thread.id, status: "SCHEDULED" },
      data: { status: "CANCELLED" },
    });
    await prisma.reminder.create({
      data: {
        userId: input.user.id,
        threadId: input.thread.id,
        remindAt: scheduleRemindAt(dueAt),
        channel: "WEB_PUSH",
        body: `You said you'd ${input.thread.title}. The time moved.`,
      },
    });
  }

  await prisma.actionProposal.update({
    where: { id: proposal.id },
    data: { status: "APPROVED" },
  });
  await prisma.thread.update({
    where: { id: input.thread.id },
    data: {
      dueAt,
      suggestedFollowUpAt: dueAt,
      status: proposal.kind === "MOVE_DEADLINE" ? "CHANGED" : "WAITING_ON_ME",
      needsUserReview: false,
      currentState: proposal.kind === "MICRO_ACTION" ? proposal.reason : "Deadline moved with your approval.",
      events: {
        create: {
          userId: input.user.id,
          kind: "PROPOSAL_APPROVED",
          body: proposal.reason,
        },
      },
    },
  });
  await writeAuditLog({
    userId: input.user.id,
    action: "ACTION_APPROVED",
    target: proposal.id,
  });
  return {
    ok: true as const,
    message:
      proposal.kind === "MICRO_ACTION"
        ? "Still will not open anything for you. The smaller step is yours."
        : "The deadline moved. Nothing else was changed.",
  };
}
