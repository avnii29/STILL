import { z } from "zod";
import { getServerEnv } from "@/lib/env";
import { telegramCapability } from "@/lib/sources/capabilities";
import type { NormalizedMessage, ProviderAdapter } from "@/lib/sources/types";

const telegramMessageSchema = z.object({
  message_id: z.number(),
  date: z.number().optional(),
  text: z.string().optional(),
  caption: z.string().optional(),
  chat: z.object({
    id: z.union([z.number(), z.string()]),
    type: z.string(),
    title: z.string().optional(),
  }),
  from: z
    .object({
      id: z.union([z.number(), z.string()]),
      first_name: z.string().optional(),
      username: z.string().optional(),
      is_bot: z.boolean().optional(),
    })
    .optional(),
  forward_origin: z.unknown().optional(),
  forward_from: z.unknown().optional(),
  forward_date: z.number().optional(),
});

export const telegramUpdateSchema = z.object({
  update_id: z.number(),
  message: telegramMessageSchema.optional(),
  callback_query: z
    .object({
      id: z.string(),
      data: z.string().optional(),
      from: z.object({ id: z.union([z.number(), z.string()]) }),
      message: z
        .object({
          message_id: z.number(),
          chat: z.object({ id: z.union([z.number(), z.string()]) }),
        })
        .optional(),
    })
    .optional(),
});

export type TelegramUpdate = z.infer<typeof telegramUpdateSchema>;

export function verifyTelegramSecret(header: string | null) {
  const expected = getServerEnv().TELEGRAM_WEBHOOK_SECRET;
  if (!expected) return false;
  return header === expected;
}

export function isPrivateTelegramChat(type: string) {
  return type === "private";
}

export function telegramStartCode(text: string | undefined) {
  if (!text) return null;
  const match = text.trim().match(/^\/start(?:@\w+)?(?:\s+([A-Za-z0-9_-]+))?$/);
  return match ? (match[1] ?? "") : null;
}

export function normalizeTelegramMessage(
  message: z.infer<typeof telegramMessageSchema>,
  userId: string,
): NormalizedMessage | null {
  const content = (message.text ?? message.caption ?? "").trim();
  if (!content || content.startsWith("/")) return null;
  return {
    id: `telegram:${message.chat.id}:${message.message_id}`,
    userId,
    provider: "TELEGRAM",
    externalMessageId: String(message.message_id),
    conversationId: String(message.chat.id),
    sender: message.from?.username || message.from?.first_name || "Telegram",
    recipient: "STILL",
    timestamp: message.date ? new Date(message.date * 1000) : new Date(),
    content,
    attachmentsMetadata: null,
    sourceUrl: null,
    permissionsContext: isPrivateTelegramChat(message.chat.type)
      ? "private_bot_chat"
      : "group_requires_forward",
    isFromUser: true,
  };
}

export async function sendTelegramMessage(input: {
  chatId: string | number;
  text: string;
  buttons?: Array<{ label: string; data: string }>;
}) {
  const token = getServerEnv().TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false as const, error: "Telegram bot is not configured." };
  const body: Record<string, unknown> = {
    chat_id: input.chatId,
    text: input.text,
  };
  if (input.buttons?.length) {
    body.reply_markup = {
      inline_keyboard: input.buttons.map((button) => [
        { text: button.label, callback_data: button.data.slice(0, 64) },
      ]),
    };
  }
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    return { ok: false as const, error: `Telegram send failed (${response.status}).` };
  }
  return { ok: true as const };
}

export async function answerTelegramCallback(id: string, text?: string) {
  const token = getServerEnv().TELEGRAM_BOT_TOKEN;
  if (!token) return;
  await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: id, text }),
  });
}

export async function telegramDeepLink(code: string) {
  const env = getServerEnv();
  const username = env.TELEGRAM_BOT_USERNAME?.replace(/^@/, "");
  if (username) return `https://t.me/${username}?start=${code}`;
  return null;
}

export const TelegramAdapter: ProviderAdapter = {
  id: "TELEGRAM",
  getCapabilities: telegramCapability,
  normalizeMessage(input, userId) {
    const parsed = telegramMessageSchema.safeParse(input);
    if (!parsed.success) return null;
    return normalizeTelegramMessage(parsed.data, userId);
  },
};
