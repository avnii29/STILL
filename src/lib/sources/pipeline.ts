import "server-only";

import type { CommitmentType, Prisma, SourceProvider, ThreadOwner } from "@/generated/prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { loadAppUserById, type AppUser } from "@/lib/auth";
import { scheduleRemindAt } from "@/lib/agents/extract";
import { logger } from "@/lib/logger";
import { createNotification } from "@/lib/notifications/dispatch";
import { getPrisma } from "@/lib/prisma";
import {
  detectCommitment,
  scoreRelevance,
  type CommitmentDetection,
} from "@/lib/sources/detect";
import { inputHash } from "@/lib/sources/hash";
import { canIngest, ingestionStoppedReason } from "@/lib/sources/permission";
import { bestThreadMatch } from "@/lib/sources/thread-match";
import type { NormalizedMessage } from "@/lib/sources/types";
import { beginIngestion, markIngestion } from "@/lib/ingestion/event-bus";
import { routeContent, shouldInterrupt } from "@/lib/ingestion/router";
import { applyDeadlineChange } from "@/lib/ingestion/signals";
import { evaluateIntervention } from "@/lib/threads/lifecycle";
import { calendarStatus } from "@/lib/integrations/google";

const MAX_MESSAGE_CHARS = 4000;

export type PipelineResult = {
  skipped?: string;
  duplicate?: boolean;
  candidateId?: string;
  threadId?: string | null;
  classification?: CommitmentDetection["classification"];
  reply?: TelegramStyleReply | null;
};

export type TelegramStyleReply = {
  text: string;
  buttons?: Array<{ label: string; data: string }>;
};

type MemoryPolicy = {
  rememberReminders: boolean;
  rememberCommitments: boolean;
  rememberPossible: boolean;
  rememberDeadlines: boolean;
  rememberResolution: boolean;
  rememberContext: boolean;
  autoRememberClear: boolean;
  conversationRetention: string;
};

export async function claimProviderEvent(input: {
  provider: SourceProvider;
  externalEventId: string;
  kind: string;
  userId?: string | null;
  accountId?: string | null;
}) {
  const prisma = getPrisma();
  try {
    const created = await prisma.providerEvent.create({
      data: {
        provider: input.provider,
        externalEventId: input.externalEventId,
        kind: input.kind,
        userId: input.userId ?? null,
        accountId: input.accountId ?? null,
      },
    });
    return { event: created, duplicate: false };
  } catch {
    const existing = await prisma.providerEvent.findUnique({
      where: {
        provider_externalEventId: {
          provider: input.provider,
          externalEventId: input.externalEventId,
        },
      },
    });
    if (!existing) throw new Error("Provider event conflict without a stored row.");
    return { event: existing, duplicate: existing.processed };
  }
}

export async function markProviderEventProcessed(id: string) {
  const prisma = getPrisma();
  await prisma.providerEvent.update({
    where: { id },
    data: { processed: true },
  });
}

export async function processNormalizedMessage(
  message: NormalizedMessage,
  extras?: { eventId?: string; accountId?: string | null },
): Promise<PipelineResult> {
  if (!message.content.trim()) {
    return { skipped: "empty" };
  }
  if (message.content.length > MAX_MESSAGE_CHARS) {
    return { skipped: "too_large" };
  }

  const prisma = getPrisma();
  const account = extras?.accountId
    ? await prisma.integrationAccount.findUnique({ where: { id: extras.accountId } })
    : await prisma.integrationAccount.findUnique({
        where: {
          userId_provider: {
            userId: message.userId,
            provider: message.provider as SourceProvider,
          },
        },
      });
  const permission = await prisma.sourcePermission.findUnique({
    where: {
      userId_provider: {
        userId: message.userId,
        provider: message.provider as SourceProvider,
      },
    },
  });

  if (
    !canIngest({
      provider: message.provider,
      status: account?.status,
      granted: permission?.granted,
    })
  ) {
    return {
      skipped: "no_permission",
      reply: {
        text:
          ingestionStoppedReason({
            status: account?.status,
            granted: permission?.granted,
          }) ?? "STILL does not have permission to use this source.",
      },
    };
  }

  const route = routeContent(message.content);
  const interrupt = shouldInterrupt(route);
  const tracked = account
    ? await beginIngestion({
        userId: message.userId,
        connectorId: account.id,
        provider: message.provider,
        externalEventId: message.externalMessageId,
        eventType: "message",
        occurredAt: message.timestamp ?? new Date(),
        payload: message.content,
        route,
        summary: interrupt.reason,
      }).catch(() => null)
    : null;
  if (tracked?.duplicate) return { duplicate: true };

  const settle = async (result: PipelineResult, summary: string) => {
    if (tracked && !tracked.duplicate) {
      await markIngestion(tracked.id, result.threadId ? "THREAD_UPDATED" : "PROCESSED", {
        route,
        summary,
      }).catch(() => undefined);
    }
    return result;
  };

  const relevance = scoreRelevance(message.content);
  if (relevance === "NONE") {
    return settle({ skipped: "irrelevant" }, interrupt.reason);
  }

  const user = await loadAppUserById(message.userId);
  if (!user) return settle({ skipped: "unknown_user" }, "Unknown user.");

  const preference = await prisma.userPreference.findUnique({
    where: { userId: user.id },
  });
  const policy: MemoryPolicy = {
    rememberReminders: preference?.rememberReminders ?? true,
    rememberCommitments: preference?.rememberCommitments ?? true,
    rememberPossible: preference?.rememberPossible ?? false,
    rememberDeadlines: preference?.rememberDeadlines ?? true,
    rememberResolution: preference?.rememberResolution ?? true,
    rememberContext: preference?.rememberContext ?? false,
    autoRememberClear: preference?.autoRememberClear ?? false,
    conversationRetention: preference?.conversationRetention ?? "EVIDENCE_ONLY",
  };

  const detection = detectCommitment({
    text: message.content,
    isFromUser: message.isFromUser,
    now: message.timestamp ?? new Date(),
    timeZone: user.timezone,
  });

  await prisma.agentRun.create({
    data: {
      userId: user.id,
      kind: "COMMITMENT_DETECT",
      input: {
        purpose: "detectCommitment",
        hash: inputHash(message.content),
        provider: message.provider,
      } as Prisma.InputJsonValue,
      output: detection as Prisma.InputJsonValue,
      ok: detection.classification !== "NON_COMMITMENT",
      confidence: detection.confidence,
    },
  });

  await writeAuditLog({
    userId: user.id,
    action: "COMMITMENT_DETECTED",
    target: message.externalMessageId,
    metadata: {
      classification: detection.classification,
      confidence: detection.confidence,
      provider: message.provider,
    },
  });

  if (route === "deadline_change") {
    const changed = await applyDeadlineChange({
      user,
      content: message.content,
      provider: message.provider,
      now: message.timestamp ?? new Date(),
    });
    if (changed.changed) {
      return settle(
        {
          threadId: changed.threadId,
          classification: detection.classification,
          reply: changed.reply,
        },
        `Deadline changed. ${interrupt.reason}`,
      );
    }
  }

  if (detection.classification === "NON_COMMITMENT") {
    return settle(
      { skipped: "non_commitment", classification: detection.classification },
      interrupt.reason,
    );
  }

  if (detection.classification === "EXTERNAL_COMMITMENT") {
    return settle(
      {
        skipped: "external",
        classification: detection.classification,
      },
      "Someone else's promise. No intervention.",
    );
  }

  if (detection.classification === "RESOLUTION_SIGNAL") {
    if (!policy.rememberResolution) {
      return { skipped: "policy", classification: detection.classification };
    }
    const resolved = await maybeResolveFromMessage({
      user,
      detection,
      provider: message.provider,
    });
    return settle(
      {
        classification: detection.classification,
        threadId: resolved.threadId,
        reply: resolved.reply,
      },
      resolved.threadId ? "Resolution evidence recorded." : "No matching thread.",
    );
  }

  if (!policyAllows(detection, policy)) {
    return settle({ skipped: "policy", classification: detection.classification }, "Memory policy skipped this.");
  }

  const stored = await persistSourceMinimum({
    message,
    accountId: account?.id ?? extras?.accountId ?? null,
    detection,
    retention: policy.conversationRetention,
  });

  const auto = shouldAutoRemember(detection, policy);
  const candidate = await prisma.memoryCandidate.create({
    data: {
      userId: user.id,
      accountId: account?.id ?? extras?.accountId ?? null,
      sourceMessageId: stored.messageId,
      provider: message.provider as SourceProvider,
      classification: detection.classification,
      confidence: detection.confidence,
      commitmentText: detection.commitment_text,
      normalizedCommitment: detection.normalized_commitment,
      actor: detection.actor,
      targetPerson: detection.target_person,
      deadline: policy.rememberDeadlines ? detection.deadline : null,
      dueAt: policy.rememberDeadlines && detection.due_at ? new Date(detection.due_at) : null,
      deadlinePrecision: detection.deadline_precision,
      evidenceSpan: detection.evidence_span,
      reasoningSummary: detection.reasoning_summary,
      status: auto ? "AUTO_STORED" : "PENDING",
    },
  });

  if (auto) {
    const memory = await createMemoryFromCandidate({
      user,
      candidateId: candidate.id,
      automatic: true,
    });
    return settle(
      {
        candidateId: candidate.id,
        threadId: memory.threadId,
        classification: detection.classification,
        reply: {
          text: `STILL remembered something.\n${detection.normalized_commitment}`,
          buttons: [{ label: "Undo", data: `undo:${candidate.id}` }],
        },
      },
      interrupt.reason,
    );
  }

  await createNotification({
    userId: user.id,
    title: "I found something worth remembering.",
    body: detection.normalized_commitment,
    href: "/home",
  });

  return settle(
    {
      candidateId: candidate.id,
      classification: detection.classification,
      reply: confirmationReply(detection, candidate.id),
    },
    interrupt.reason,
  );
}

function policyAllows(detection: CommitmentDetection, policy: MemoryPolicy) {
  if (detection.classification === "REMINDER_REQUEST") return policy.rememberReminders;
  if (detection.classification === "COMMITMENT") return policy.rememberCommitments;
  if (detection.classification === "POSSIBLE_COMMITMENT") return true;
  return false;
}

function shouldAutoRemember(detection: CommitmentDetection, policy: MemoryPolicy) {
  if (detection.classification === "REMINDER_REQUEST" && !detection.ask_when) {
    return true;
  }
  if (detection.classification === "COMMITMENT" && policy.autoRememberClear && detection.confidence >= 0.8) {
    return true;
  }
  return false;
}

function confirmationReply(detection: CommitmentDetection, candidateId: string): TelegramStyleReply {
  if (detection.classification === "POSSIBLE_COMMITMENT") {
    return {
      text: `Sounds like you might be planning this. Want me to remember it?\n\n${detection.normalized_commitment.toUpperCase()}\n${detection.target_person ? `to ${detection.target_person}` : ""}\n${detection.deadline ?? ""}`.trim(),
      buttons: [
        { label: "Remember", data: `remember:${candidateId}` },
        { label: "Not a commitment", data: `ignore:${candidateId}` },
      ],
    };
  }
  if (detection.ask_when) {
    return {
      text: `I found something worth remembering.\n\n${detection.normalized_commitment.toUpperCase()}\n${detection.when_prompt ?? "When should I remind you?"}`,
      buttons: [
        { label: "Later today", data: `when:${candidateId}:later_today` },
        { label: "Tomorrow", data: `when:${candidateId}:tomorrow` },
        { label: "This evening", data: `when:${candidateId}:evening` },
        { label: "Remember", data: `remember:${candidateId}` },
        { label: "Ignore", data: `ignore:${candidateId}` },
      ],
    };
  }
  return {
    text: `I found something worth remembering.\n\n${detection.normalized_commitment.toUpperCase()}\n${detection.target_person ? `to ${detection.target_person}` : ""}\n${detection.deadline ?? ""}`.trim(),
    buttons: [
      { label: "Remember", data: `remember:${candidateId}` },
      { label: "Ignore", data: `ignore:${candidateId}` },
    ],
  };
}

async function persistSourceMinimum(input: {
  message: NormalizedMessage;
  accountId: string | null;
  detection: CommitmentDetection;
  retention: string;
}) {
  const prisma = getPrisma();
  const retainSource = input.retention === "RETAIN_SOURCE";
  const retainEvidence = input.retention !== "NONE";
  const content = retainSource
    ? input.message.content.slice(0, MAX_MESSAGE_CHARS)
    : retainEvidence
      ? input.detection.evidence_span.slice(0, MAX_MESSAGE_CHARS)
      : "";

  if (!content) {
    return { messageId: null as string | null, conversationId: null as string | null };
  }

  const conversation = await prisma.sourceConversation.upsert({
    where: {
      userId_provider_externalId: {
        userId: input.message.userId,
        provider: input.message.provider as SourceProvider,
        externalId: input.message.conversationId,
      },
    },
    update: { retained: retainSource },
    create: {
      userId: input.message.userId,
      accountId: input.accountId,
      provider: input.message.provider as SourceProvider,
      externalId: input.message.conversationId,
      title: input.message.sender,
      retained: retainSource,
    },
  });

  const stored = await prisma.sourceMessage.upsert({
    where: {
      userId_provider_externalMessageId: {
        userId: input.message.userId,
        provider: input.message.provider as SourceProvider,
        externalMessageId: input.message.externalMessageId,
      },
    },
    update: {
      content,
      retained: retainSource,
    },
    create: {
      userId: input.message.userId,
      accountId: input.accountId,
      conversationId: conversation.id,
      provider: input.message.provider as SourceProvider,
      externalMessageId: input.message.externalMessageId,
      sender: input.message.sender,
      recipient: input.message.recipient,
      sentAt: input.message.timestamp,
      content,
      attachmentsMetadata: input.message.attachmentsMetadata as Prisma.InputJsonValue,
      sourceUrl: input.message.sourceUrl,
      permissionsContext: input.message.permissionsContext,
      isFromUser: input.message.isFromUser,
      retained: retainSource,
    },
  });

  await writeAuditLog({
    userId: input.message.userId,
    action: "SOURCE_INGESTED",
    target: stored.id,
    metadata: { provider: input.message.provider, retained: retainSource },
  });

  return { messageId: stored.id, conversationId: conversation.id };
}

async function maybeResolveFromMessage(input: {
  user: AppUser;
  detection: CommitmentDetection;
  provider?: string;
}) {
  const prisma = getPrisma();
  const open = await prisma.thread.findMany({
    where: {
      userId: input.user.id,
      status: {
        in: [
          "DETECTED",
          "NEEDS_REVIEW",
          "OPEN",
          "WAITING_ON_ME",
          "WAITING_ON_THEM",
          "APPROACHING",
          "POSTPONED",
          "CHANGED",
        ],
      },
    },
    include: { person: true },
    take: 20,
  });
  const match = bestThreadMatch(
    open.map((thread) => ({
      id: thread.id,
      title: thread.title,
      evidence: thread.evidence,
      personName: thread.person?.name,
    })),
    input.detection,
  );
  if (!match) {
    return { threadId: null as string | null, reply: null as TelegramStyleReply | null };
  }
  if (match.certainty === "UNCERTAIN") {
    return {
      threadId: match.thread.id,
      reply: {
        text: "Is this about your existing thread?",
        buttons: [
          { label: "Yes, it's done", data: `resolve:${match.thread.id}` },
          { label: "No", data: `ignore:${match.thread.id}` },
        ],
      },
    };
  }
  if (input.detection.confidence < 0.75) {
    return {
      threadId: match.thread.id,
      reply: {
        text: "This might close an existing thread. Confirm if it is done.",
        buttons: [
          { label: "Mark resolved", data: `resolve:${match.thread.id}` },
          { label: "Keep it open", data: `ignore:${match.thread.id}` },
        ],
      },
    };
  }
  const quote = input.detection.evidence_span.slice(0, 280);
  const source = input.provider ?? "source";
  const cancel = routeContent(quote) === "cancellation";
  const confirmed = input.detection.confidence >= 0.9;
  if (confirmed) {
    await prisma.reminder.updateMany({
      where: { threadId: match.thread.id, status: "SCHEDULED" },
      data: { status: "CANCELLED" },
    });
    await prisma.resolution.upsert({
      where: { threadId: match.thread.id },
      create: {
        userId: input.user.id,
        threadId: match.thread.id,
        kind: cancel ? "CANCELLED" : "FULFILLED",
        evidence: quote,
        note: source,
      },
      update: {
        kind: cancel ? "CANCELLED" : "FULFILLED",
        evidence: quote,
        note: source,
      },
    });
    const commitments = await prisma.commitment.findMany({
      where: { threadId: match.thread.id },
      select: { id: true },
    });
    if (commitments.length > 0) {
      await prisma.commitmentEvidence.createMany({
        data: commitments.map((commitment) => ({
          userId: input.user.id,
          commitmentId: commitment.id,
          exactText: quote,
          sourceKind: source,
          sourceProvider: source,
          confidence: input.detection.confidence,
        })),
      });
    }
  }
  await prisma.thread.update({
    where: { id: match.thread.id },
    data: {
      status: confirmed ? "RESOLVED" : "LIKELY_RESOLVED",
      resolvedAt: confirmed ? new Date() : null,
      resolutionReason: confirmed ? quote : null,
      currentState: quote,
      events: {
        create: {
          userId: input.user.id,
          kind: confirmed ? "RESOLVED" : "LIKELY_RESOLVED",
          body: confirmed
            ? `Evidence found\n"${quote}"\nSource\n${source}\nConfidence\n${Math.round(input.detection.confidence * 100)}%`
            : quote,
        },
      },
    },
  });
  if (confirmed) {
    await createNotification({
      userId: input.user.id,
      title: cancel ? "Commitment cancelled" : "Resolved",
      body: `"${quote}"\nSource: ${source}`,
      href: `/threads/${match.thread.id}`,
      topic: "resolved",
    });
  }
  return {
    threadId: match.thread.id,
    reply: {
      text: confirmed ? "STILL marked this resolved from the source." : "STILL detected a possible resolution.",
      buttons: [{ label: "Open thread", data: `open:${match.thread.id}` }],
    },
  };
}

export async function createMemoryFromCandidate(input: {
  user: AppUser;
  candidateId: string;
  automatic?: boolean;
  dueAt?: Date | null;
}) {
  const prisma = getPrisma();
  const candidate = await prisma.memoryCandidate.findFirst({
    where: { id: input.candidateId, userId: input.user.id },
  });
  if (!candidate) {
    throw new Error("That memory candidate is gone.");
  }

  const personName = candidate.targetPerson?.trim();
  let person = personName
    ? await prisma.person.findFirst({
        where: {
          userId: input.user.id,
          name: { equals: personName, mode: "insensitive" },
        },
      })
    : null;
  if (!person && personName && !["you", "me", "us"].includes(personName.toLowerCase())) {
    person = await prisma.person.create({
      data: { userId: input.user.id, name: personName },
    });
  }

  const sourceKind = toSourceKind(candidate.provider);
  let source = await prisma.conversationSource.findFirst({
    where: { userId: input.user.id, kind: sourceKind },
  });
  if (source) {
    source = await prisma.conversationSource.update({
      where: { id: source.id },
      data: { lastSyncedAt: new Date() },
    });
  } else {
    source = await prisma.conversationSource.create({
      data: {
        userId: input.user.id,
        kind: sourceKind,
        label: sourceKindLabel(sourceKind),
      },
    });
  }

  const dueAt = input.dueAt ?? candidate.dueAt;
  const type = toCommitmentType(candidate.classification);
  const owner = toOwner(candidate.actor);
  const thread = await prisma.thread.create({
    data: {
      userId: input.user.id,
      personId: person?.id,
      title: candidate.normalizedCommitment,
      summary: candidate.reasoningSummary,
      source: sourceKind,
      sourceId: source.id,
      commitmentType: type,
      owner,
      confidence: candidate.confidence,
      status: candidate.classification === "POSSIBLE_COMMITMENT" ? "NEEDS_REVIEW" : "DETECTED",
      lastEvidenceAt: new Date(),
      suggestedNextAction: "Keep it until you decide otherwise.",
      suggestedFollowUpAt: dueAt,
      dueAt,
      evidence: candidate.evidenceSpan,
      context: candidate.reasoningSummary,
      currentState: "Remembered from a source you allowed.",
      needsUserReview: !input.automatic,
      interpretedBy: "heuristic",
      commitments: {
        create: {
          userId: input.user.id,
          personId: person?.id,
          type,
          owner,
          text: candidate.commitmentText,
          normalizedText: candidate.normalizedCommitment,
          dueHint: candidate.deadline,
          dueAt,
          deadlineConfidence: candidate.dueAt ? 0.8 : 0,
          confidence: candidate.confidence,
          isCommitment: candidate.classification !== "POSSIBLE_COMMITMENT",
          evidenceItems: {
            create: {
              userId: input.user.id,
              exactText: candidate.evidenceSpan,
              sourceKind,
              sourceProvider: candidate.provider,
              confidence: candidate.confidence,
            },
          },
        },
      },
      events: {
        create: [
          {
            userId: input.user.id,
            kind: input.automatic ? "AUTO_REMEMBERED" : "REMEMBERED",
            body: candidate.evidenceSpan,
          },
          {
            userId: input.user.id,
            kind: "EVIDENCE_STORED",
            body: candidate.evidenceSpan,
          },
        ],
      },
    },
  });

  if (dueAt) {
    const remindAt = scheduleRemindAt(dueAt);
    await prisma.reminder.create({
      data: {
        userId: input.user.id,
        threadId: thread.id,
        remindAt,
        channel: "WEB_PUSH",
        body: `You said you'd ${candidate.normalizedCommitment}.`,
      },
    });
    await writeAuditLog({
      userId: input.user.id,
      action: "REMINDER_CREATED",
      target: thread.id,
    });
  }

  const calendar = calendarStatus(false);
  const intervention = evaluateIntervention({
    dueAt,
    postponementCount: 0,
    calendarConnected: calendar.connected,
    hasConflict: false,
    latestEvidence: candidate.evidenceSpan,
  });
  await prisma.agentRun.create({
    data: {
      userId: input.user.id,
      threadId: thread.id,
      kind: "INTERVENTION",
      input: { hash: inputHash(candidate.evidenceSpan), purpose: "generateIntervention" } as Prisma.InputJsonValue,
      output: intervention as Prisma.InputJsonValue,
      ok: true,
      confidence: intervention.confidence,
    },
  });

  await prisma.memoryCandidate.update({
    where: { id: candidate.id },
    data: {
      status: input.automatic ? "AUTO_STORED" : "REMEMBERED",
      threadId: thread.id,
      dueAt,
    },
  });

  await writeAuditLog({
    userId: input.user.id,
    action: "MEMORY_CREATED",
    target: thread.id,
    metadata: { automatic: Boolean(input.automatic), provider: candidate.provider },
  });

  await createNotification({
    userId: input.user.id,
    title: input.automatic ? "STILL remembered something." : "Something still matters.",
    body: candidate.normalizedCommitment,
    href: `/threads/${thread.id}`,
  });

  logger.info("memory.created", {
    userId: input.user.id,
    threadId: thread.id,
    automatic: Boolean(input.automatic),
    provider: candidate.provider,
  });

  return { threadId: thread.id };
}

export async function ignoreCandidate(input: { userId: string; candidateId: string }) {
  const prisma = getPrisma();
  const candidate = await prisma.memoryCandidate.findFirst({
    where: { id: input.candidateId, userId: input.userId },
  });
  if (!candidate) return null;
  await prisma.memoryCandidate.update({
    where: { id: candidate.id },
    data: { status: "IGNORED" },
  });
  return candidate;
}

export async function undoCandidateMemory(input: { user: AppUser; candidateId: string }) {
  const prisma = getPrisma();
  const candidate = await prisma.memoryCandidate.findFirst({
    where: { id: input.candidateId, userId: input.user.id },
  });
  if (!candidate?.threadId) return null;
  await prisma.thread.delete({
    where: { id: candidate.threadId },
  });
  await prisma.memoryCandidate.update({
    where: { id: candidate.id },
    data: { status: "IGNORED", threadId: null },
  });
  await writeAuditLog({
    userId: input.user.id,
    action: "MEMORY_DELETED",
    target: candidate.threadId,
    metadata: { undo: true },
  });
  return candidate;
}

function toSourceKind(provider: SourceProvider) {
  if (provider === "TELEGRAM") return "TELEGRAM" as const;
  if (provider === "WHATSAPP") return "WHATSAPP" as const;
  if (provider === "INSTAGRAM") return "INSTAGRAM" as const;
  if (provider === "EMAIL") return "EMAIL" as const;
  if (provider === "VOICE") return "VOICE" as const;
  if (provider === "PASTE") return "PASTE" as const;
  return "MANUAL" as const;
}

function sourceKindLabel(kind: string) {
  if (kind === "TELEGRAM") return "Telegram";
  if (kind === "WHATSAPP") return "WhatsApp";
  if (kind === "INSTAGRAM") return "Instagram";
  if (kind === "VOICE") return "Voice";
  if (kind === "EMAIL") return "Email";
  return "Manual capture";
}

function toCommitmentType(classification: string): CommitmentType {
  if (classification === "REMINDER_REQUEST") return "REMINDER_REQUEST";
  if (classification === "POSSIBLE_COMMITMENT") return "FUTURE_INTENTION";
  return "EXPLICIT_PROMISE";
}

function toOwner(actor: string): ThreadOwner {
  if (actor === "SELF" || actor === "ME") return "ME";
  if (actor === "THEM") return "THEM";
  return "ME";
}
