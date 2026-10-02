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
  const intervention = evaluateIntervention({
    dueAt: input.thread.dueAt,
    postponementCount: advice.count,
    calendarConnected: calendar.connected,
    hasConflict: false,
    latestEvidence: input.thread.evidence,
  });
  const nextDue =
    chosenDue && !Number.isNaN(chosenDue.getTime()) ? chosenDue : nextDeadlineFrom(input.thread.dueAt);

  const interventionRow = await prisma.intervention.create({
    data: {
      userId: input.user.id,
      threadId: input.thread.id,
      reason: intervention.reason,
      suggestedAction: advice.suggestedAction,
      confidence: intervention.confidence,
      requiresApproval: true,
      status: "PENDING",
      metadata: { postpone: advice } as Prisma.InputJsonValue,
    },
  });

  const redTeam = redTeamExternalAction({
    proposal: advice.kind === "MOVE_DEADLINE" ? `MOVE DEADLINE ${input.thread.title}` : advice.suggestedAction,
    evidence: input.thread.evidence,
    stillActive: input.thread.status !== "RESOLVED" && input.thread.status !== "DISMISSED",
  });

  const proposalKind =
    advice.proposalKind === "MOVE_DEADLINE"
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
      target: input.thread.title,
      reason: advice.prompt,
      risk: advice.count >= 3 ? "medium" : "low",
      status: redTeam.allowed ? "PENDING" : "BLOCKED",
      requiresApproval: true,
      blockedReason: redTeam.blockedReason,
      metadata: {
        calendar: calendar.message,
        docs: docsStatus(false).message,
        nextDue: nextDue.toISOString(),
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
      },
      {
        userId: input.user.id,
        threadId: input.thread.id,
        kind: "INTERVENTION",
        input: { postponementCount: advice.count } as Prisma.InputJsonValue,
        output: intervention as Prisma.InputJsonValue,
        ok: true,
        confidence: intervention.confidence,
      },
      {
        userId: input.user.id,
        threadId: input.thread.id,
        kind: "RED_TEAM",
        input: { proposal: proposal.kind } as Prisma.InputJsonValue,
        output: redTeam as Prisma.InputJsonValue,
        ok: redTeam.allowed,
        confidence: redTeam.allowed ? 0.62 : 0.9,
      },
    ],
  });

  await prisma.thread.update({
    where: { id: input.thread.id },
    data: {
      postponementCount: advice.count,
      status: "POSTPONED",
      dueAt: nextDue,
      suggestedFollowUpAt: nextDue,
      currentState: advice.prompt,
      suggestedNextAction: advice.suggestedAction,
      events: {
        create: {
          userId: input.user.id,
          kind: "POSTPONED",
          body: advice.prompt,
          metadata: { count: advice.count, proposalId: proposal.id } as Prisma.InputJsonValue,
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
      ? advice.prompt
      : redTeam.blockedReason ?? "Still blocked this action.",
  };
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

  if (proposal.kind === "MOVE_CALENDAR_EVENT") {
    const calendar = calendarStatus(false);
    await prisma.actionProposal.update({
      where: { id: proposal.id },
      data: { status: "BLOCKED", blockedReason: calendar.message },
    });
    await prisma.threadEvent.create({
      data: {
        userId: input.user.id,
        threadId: input.thread.id,
        kind: "ACTION_BLOCKED",
        body: calendar.message,
      },
    });
    return { ok: false as const, message: calendar.message };
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
