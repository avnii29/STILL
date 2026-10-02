import { NextResponse } from "next/server";
import { loadAppUserById } from "@/lib/auth";
import { handleRouteError, jsonError, clientIp } from "@/lib/http";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { applyThreadAction } from "@/lib/threads/actions";
import {
  completeTelegramLink,
  findTelegramAccountByChat,
} from "@/lib/sources/accounts";
import {
  createMemoryFromCandidate,
  ignoreCandidate,
  processNormalizedMessage,
  undoCandidateMemory,
  claimProviderEvent,
  markProviderEventProcessed,
} from "@/lib/sources/pipeline";
import { resolveTemporal } from "@/lib/sources/temporal";
import {
  answerTelegramCallback,
  isPrivateTelegramChat,
  normalizeTelegramMessage,
  sendTelegramMessage,
  telegramStartCode,
  telegramUpdateSchema,
  verifyTelegramSecret,
} from "@/lib/sources/telegram";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const limited = rateLimit(`telegram-webhook:${clientIp(request) ?? "anon"}`, 60, 60 * 1000);
    if (!limited.allowed) {
      return jsonError(429, "Too many provider events.", { retryAfterMs: limited.retryAfterMs });
    }

    if (!verifyTelegramSecret(request.headers.get("x-telegram-bot-api-secret-token"))) {
      return jsonError(401, "Invalid Telegram webhook.");
    }

    const payload = telegramUpdateSchema.parse(await request.json());
    const claimed = await claimProviderEvent({
      provider: "TELEGRAM",
      externalEventId: String(payload.update_id),
      kind: payload.callback_query ? "callback" : payload.message ? "message" : "update",
    });
    if (claimed.duplicate) {
      return NextResponse.json({ ok: true, duplicate: true });
    }

    if (payload.callback_query) {
      await handleCallback(payload.callback_query);
      await markProviderEventProcessed(claimed.event.id);
      return NextResponse.json({ ok: true });
    }

    const message = payload.message;
    if (!message) {
      await markProviderEventProcessed(claimed.event.id);
      return NextResponse.json({ ok: true });
    }

    const chatId = String(message.chat.id);
    const start = telegramStartCode(message.text);
    if (start !== null) {
      if (!start) {
        await sendTelegramMessage({
          chatId,
          text: "Open STILL and connect Telegram to get a link. STILL looks for things you said you'd do.",
        });
        await markProviderEventProcessed(claimed.event.id);
        return NextResponse.json({ ok: true });
      }
      const linked = await completeTelegramLink({
        linkCode: start,
        chatId,
        telegramUserId: message.from ? String(message.from.id) : undefined,
      });
      await sendTelegramMessage({
        chatId,
        text: linked
          ? "Connected. Forward a message to STILL, or send something you said you'd do. STILL will only use what you send here."
          : "That link is no longer valid. Open STILL and connect Telegram again.",
      });
      await markProviderEventProcessed(claimed.event.id);
      return NextResponse.json({ ok: true });
    }

    if (!isPrivateTelegramChat(message.chat.type)) {
      await sendTelegramMessage({
        chatId,
        text: "Forward this message to STILL. The bot cannot see every group message.",
      });
      await markProviderEventProcessed(claimed.event.id);
      return NextResponse.json({ ok: true, skipped: "group" });
    }

    const account = await findTelegramAccountByChat(chatId);
    if (!account || account.status !== "CONNECTED") {
      await sendTelegramMessage({
        chatId,
        text: "Open STILL and connect Telegram first. STILL will not silently read this chat.",
      });
      await markProviderEventProcessed(claimed.event.id);
      return NextResponse.json({ ok: true, skipped: "not_connected" });
    }

    const normalized = normalizeTelegramMessage(message, account.userId);
    if (!normalized) {
      await markProviderEventProcessed(claimed.event.id);
      return NextResponse.json({ ok: true, skipped: "empty" });
    }

    const result = await processNormalizedMessage(normalized, { accountId: account.id });
    if (result.reply) {
      await sendTelegramMessage({
        chatId,
        text: result.reply.text,
        buttons: result.reply.buttons,
      });
    }
    await markProviderEventProcessed(claimed.event.id);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    logger.error("telegram.webhook.failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return handleRouteError(error, "telegram.webhook");
  }
}

async function handleCallback(query: {
  id: string;
  data?: string;
  from: { id: number | string };
  message?: { chat: { id: number | string } };
}) {
  const chatId = query.message?.chat.id;
  const data = query.data ?? "";
  const [action, target, extra] = data.split(":");
  if (!chatId || !action || !target) {
    await answerTelegramCallback(query.id);
    return;
  }

  const account = await findTelegramAccountByChat(String(chatId));
  if (!account) {
    await answerTelegramCallback(query.id, "This chat is not connected.");
    return;
  }
  const user = await loadAppUserById(account.userId);
  if (!user) {
    await answerTelegramCallback(query.id);
    return;
  }

  if (action === "remember") {
    const memory = await createMemoryFromCandidate({ user, candidateId: target });
    await answerTelegramCallback(query.id, "Remembered.");
    await sendTelegramMessage({
      chatId,
      text: "You're still in control. STILL kept the evidence with this memory.",
    });
    return memory;
  }

  if (action === "ignore") {
    await ignoreCandidate({ userId: user.id, candidateId: target });
    await answerTelegramCallback(query.id, "Ignored.");
    return;
  }

  if (action === "undo") {
    await undoCandidateMemory({ user, candidateId: target });
    await answerTelegramCallback(query.id, "Forgotten.");
    return;
  }

  if (action === "when") {
    const phrase =
      extra === "later_today" ? "later today" : extra === "evening" ? "this evening" : "tomorrow";
    const temporal = resolveTemporal({ text: phrase, timeZone: user.timezone });
    await createMemoryFromCandidate({
      user,
      candidateId: target,
      dueAt: temporal?.dueAt ?? null,
    });
    await answerTelegramCallback(query.id, "Remembered.");
    return;
  }

  if (action === "resolve") {
    await applyThreadAction({
      user,
      threadId: target,
      action: "resolve",
      resolutionKind: "FULFILLED",
    });
    await answerTelegramCallback(query.id, "Marked resolved.");
    return;
  }

  await answerTelegramCallback(query.id);
}

export async function GET() {
  return NextResponse.json({ ok: true, provider: "TELEGRAM" });
}
