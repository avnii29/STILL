import "server-only";

import type { ConversationSourceKind, Prisma, ThreadStatus } from "@/generated/prisma/client";
import { getLanguageModel } from "@/lib/agents/provider";
import { parseConversationText } from "@/lib/agents/ingestion";
import { detectThreadsFromMessages } from "@/lib/agents/pipeline";
import { extractCommitment, scheduleRemindAt } from "@/lib/agents/extract";
import { runResolutionAgent } from "@/lib/agents/resolution-agent";
import { writeAuditLog } from "@/lib/audit";
import { getPrisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import type { AppUser } from "@/lib/auth";
import { createNotification } from "@/lib/notifications/dispatch";
import { runStillLoop } from "@/lib/agents/orchestrator";
import { evaluateIntervention } from "@/lib/threads/lifecycle";
import { calendarStatus } from "@/lib/integrations/google";
import {
  excerptForRetention,
  messagesForRetention,
  normalizeRetention,
} from "@/lib/privacy/retention";

export async function ingestConversation(input: {
  user: AppUser;
  conversationText: string;
  personName?: string;
  title?: string;
  ip?: string;
  sourceKind?: ConversationSourceKind;
  quiet?: boolean;
}) {
  const prisma = getPrisma();
  const messages = parseConversationText(input.conversationText);
  if (messages.length === 0) {
    throw new Error("Nothing to ingest.");
  }

  const sourceKind: ConversationSourceKind = input.sourceKind ?? "PASTE";
  const preference = await prisma.userPreference.findUnique({
    where: { userId: input.user.id },
  });
  const retention = normalizeRetention(preference?.conversationRetention);
  const extractedHint = extractCommitment({
    text: input.conversationText,
    personHint: input.personName,
  });
  const personName = input.personName?.trim() || extractedHint.person || undefined;
  let person = personName
    ? await prisma.person.findFirst({
        where: {
          userId: input.user.id,
          name: { equals: personName, mode: "insensitive" },
        },
      })
    : null;

  if (!person && personName) {
    person = await prisma.person.create({
      data: { userId: input.user.id, name: personName },
    });
  }

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
        label: sourceLabel(sourceKind),
      },
    });
  }

  const model = getLanguageModel();
  const detections = await detectThreadsFromMessages({
    messages,
    personName: person?.name,
    model,
  });
  const evidenceTexts = [
    extractedHint.evidence,
    ...detections.map((item) => item.evidence),
  ].filter(Boolean);
  const keptMessages = messagesForRetention(messages, evidenceTexts, retention);
  const excerpt = excerptForRetention(input.conversationText, evidenceTexts, retention);

  const conversation =
    excerpt || keptMessages.length > 0
      ? await prisma.conversation.create({
          data: {
            userId: input.user.id,
            sourceId: source.id,
            title: input.title ?? (person ? `With ${person.name}` : "Captured conversation"),
            rawExcerpt: excerpt,
            occurredAt: new Date(),
            messages: {
              create: keptMessages.map((message) => ({
                userId: input.user.id,
                personId: person?.id,
                speaker: message.speaker,
                body: message.body,
                isFromUser: message.isFromUser,
                sentAt: new Date(),
              })),
            },
          },
          include: { messages: true },
        })
      : null;

  if (conversation) {
    await writeAuditLog({
      userId: input.user.id,
      action: "CONVERSATION_INGESTED",
      target: conversation.id,
      ip: input.ip,
      metadata: { retention, storedMessages: keptMessages.length },
    });
  }

  const existingPaste = await prisma.integration.findUnique({
    where: { userId_kind: { userId: input.user.id, kind: "MANUAL_PASTE" } },
  });
  await prisma.integration.upsert({
    where: { userId_kind: { userId: input.user.id, kind: "MANUAL_PASTE" } },
    update: { status: "CONNECTED", connectedAt: new Date(), lastError: null },
    create: {
      userId: input.user.id,
      kind: "MANUAL_PASTE",
      status: "CONNECTED",
      label: "Pasted conversations",
      connectedAt: new Date(),
    },
  });
  if (!existingPaste || existingPaste.status !== "CONNECTED") {
    await writeAuditLog({
      userId: input.user.id,
      action: "INTEGRATION_CONNECTED",
      target: "MANUAL_PASTE",
      ip: input.ip,
    });
  }

  const createdThreadIds: string[] = [];

  for (const detection of detections) {
    if (!detection.shouldSurface && !detection.needs_user_review && !detection.uncertain) continue;

    const storedMessages = conversation?.messages ?? [];
    const sourceMessage =
      storedMessages.find((item) => item.body === detection.evidence) ?? storedMessages[0];
    const extracted = extractCommitment({
      text: detection.evidence,
      personHint: detection.personName ?? person?.name,
    });
    const dueAt = extracted.due_at ? new Date(extracted.due_at) : null;

    const status: ThreadStatus = detection.uncertain
      ? "NEEDS_REVIEW"
      : detection.shouldSurface
        ? detection.needs_user_review
          ? "NEEDS_REVIEW"
          : "DETECTED"
        : "NEEDS_REVIEW";

    const thread = await prisma.thread.create({
      data: {
        userId: input.user.id,
        personId: person?.id,
        title: extracted.normalized_commitment || detection.title,
        summary: detection.current_state,
        source: sourceKind,
        sourceId: source.id,
        conversationId: conversation?.id,
        sourceMessageId: sourceMessage?.id,
        commitmentType: detection.type,
        owner: detection.owner,
        confidence: extracted.confidence || detection.confidence,
        status,
        lastEvidenceAt: new Date(),
        suggestedNextAction: detection.suggested_action,
        suggestedFollowUpAt: dueAt,
        dueAt,
        evidence: extracted.evidence,
        context: `${detection.context}\n\n${detection.socialCaution}`,
        currentState: detection.current_state,
        needsUserReview: true,
        interpretedBy: detection.meta.interpretedBy,
        commitments: {
          create: {
            userId: input.user.id,
            personId: person?.id,
            messageId: sourceMessage?.id,
            type: detection.type,
            owner: detection.owner,
            text: extracted.evidence,
            normalizedText: extracted.normalized_commitment,
            dueHint: extracted.deadline,
            dueAt,
            deadlineConfidence: extracted.deadline_confidence,
            confidence: extracted.confidence,
            isCommitment: extracted.is_commitment,
            evidenceItems: {
              create: {
                userId: input.user.id,
                messageId: sourceMessage?.id,
                exactText: extracted.evidence,
                sourceKind,
              },
            },
          },
        },
        events: {
          create: [
            {
              userId: input.user.id,
              kind: "DETECTED",
              body: extracted.evidence,
              metadata: {
                interpretedBy: detection.meta.interpretedBy,
                provider: detection.meta.provider,
                extraction: extracted,
              } as Prisma.InputJsonValue,
            },
            {
              userId: input.user.id,
              kind: "EVIDENCE_STORED",
              body: extracted.evidence,
            },
          ],
        },
      },
    });

    createdThreadIds.push(thread.id);

    await prisma.agentRun.create({
      data: {
        userId: input.user.id,
        threadId: thread.id,
        kind: "EXTRACT",
        input: { text: extracted.evidence } as Prisma.InputJsonValue,
        output: extracted as Prisma.InputJsonValue,
        ok: extracted.is_commitment || extracted.uncertain,
        confidence: extracted.confidence,
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
          body: reminderBody(extracted.normalized_commitment || detection.title, dueAt),
        },
      });
      await prisma.threadEvent.create({
        data: {
          userId: input.user.id,
          threadId: thread.id,
          kind: "REMINDER_SCHEDULED",
          body: remindAt.toISOString(),
        },
      });
    }

    const calendar = calendarStatus(false);
    const intervention = evaluateIntervention({
      dueAt,
      postponementCount: 0,
      calendarConnected: calendar.connected,
      hasConflict: false,
      latestEvidence: extracted.evidence,
    });
    await prisma.agentRun.create({
      data: {
        userId: input.user.id,
        threadId: thread.id,
        kind: "INTERVENTION",
        input: { dueAt, postponementCount: 0 } as Prisma.InputJsonValue,
        output: intervention as Prisma.InputJsonValue,
        ok: true,
        confidence: intervention.confidence,
      },
    });
    const loop = runStillLoop({
      text: extracted.evidence,
      now: new Date(),
      timeZone: input.user.timezone,
      calendarConnected: calendar.connected,
    });
    await prisma.agentRun.createMany({
      data: loop.steps.map((item) => ({
        userId: input.user.id,
        threadId: thread.id,
        kind: item.agent,
        input: { purpose: item.agent } as Prisma.InputJsonValue,
        output: {
          decision: item.decision,
          confidence: item.confidence,
          risk: item.risk ?? null,
        } as Prisma.InputJsonValue,
        ok: item.ok,
        confidence: item.confidence,
      })),
    });

    await writeAuditLog({
      userId: input.user.id,
      action: "THREAD_CREATED",
      target: thread.id,
      ip: input.ip,
    });
  }

  await maybeResolveOlderThreads({
    userId: input.user.id,
    personId: person?.id,
    laterMessages: messages.map((message) => `${message.speaker}: ${message.body}`),
  });

  if (createdThreadIds.length > 0 && !input.quiet) {
    await createNotification({
      userId: input.user.id,
      title: createdThreadIds.length === 1 ? "Something still matters" : "A few things still matter",
      body:
        createdThreadIds.length === 1
          ? "Still noticed an unfinished conversation. It is waiting for you to look."
          : "Still noticed unfinished conversations. They are waiting for you to look.",
      href: "/home",
    });
  }

  logger.info("ingest.complete", {
    userId: input.user.id,
    conversationId: conversation?.id ?? null,
    threadCount: createdThreadIds.length,
    interpretedBy: model ? "llm" : "heuristic",
  });

  return {
    conversationId: conversation?.id ?? null,
    threadIds: createdThreadIds,
    interpretedBy: model ? "llm" : "heuristic",
  };
}

export async function rememberNote(input: {
  user: AppUser;
  note: string;
  personName?: string;
  isSelf?: boolean;
  ip?: string;
  sourceKind?: ConversationSourceKind;
  quiet?: boolean;
}) {
  return ingestConversation({
    user: input.user,
    conversationText: `Me: ${input.note}`,
    personName: input.isSelf ? undefined : input.personName,
    title: input.isSelf ? "Something I told myself" : undefined,
    ip: input.ip,
    sourceKind: input.sourceKind ?? (input.isSelf ? "TEXT" : "MANUAL"),
    quiet: input.quiet,
  });
}

async function maybeResolveOlderThreads(input: {
  userId: string;
  personId?: string;
  laterMessages: string[];
}) {
  const prisma = getPrisma();
  const open = await prisma.thread.findMany({
    where: {
      userId: input.userId,
      personId: input.personId,
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
    orderBy: { createdAt: "asc" },
    take: 20,
  });

  const model = getLanguageModel();
  for (const thread of open) {
    const look = await runResolutionAgent({
      original: thread.evidence,
      laterMessages: input.laterMessages.filter((line) => !line.includes(thread.evidence)),
      model,
    });
    if (!look.likelyResolved) continue;
    await prisma.thread.update({
      where: { id: thread.id },
      data: {
        status: "LIKELY_RESOLVED",
        currentState: look.evidence,
        resolutionReason: look.uncertainty,
        events: {
          create: {
            userId: input.userId,
            kind: "LIKELY_RESOLVED",
            body: look.evidence,
          },
        },
      },
    });
  }
}

function sourceLabel(kind: ConversationSourceKind) {
  if (kind === "VOICE") return "Spoken notes";
  if (kind === "TEXT") return "Typed notes";
  if (kind === "MANUAL") return "Manual capture";
  if (kind === "TELEGRAM") return "Telegram";
  if (kind === "WHATSAPP") return "WhatsApp";
  if (kind === "INSTAGRAM") return "Instagram";
  if (kind === "EMAIL") return "Email";
  return "Pasted conversations";
}

function reminderBody(title: string, dueAt: Date) {
  const hours = Math.max(0, Math.round((dueAt.getTime() - Date.now()) / 3_600_000));
  if (hours <= 2) return `You said you'd ${title}. A little time left.`;
  return `You said you'd ${title}. ${hours} hours left.`;
}
