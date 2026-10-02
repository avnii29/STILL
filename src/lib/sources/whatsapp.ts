import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { getServerEnv } from "@/lib/env";
import { whatsappCapability } from "@/lib/sources/capabilities";
import type { NormalizedMessage, ProviderAdapter } from "@/lib/sources/types";

const whatsappMessageSchema = z.object({
  id: z.string(),
  from: z.string().optional(),
  timestamp: z.string().optional(),
  type: z.string().optional(),
  text: z.object({ body: z.string().optional() }).optional(),
});

export function verifyWhatsAppSignature(rawBody: string, signatureHeader: string | null) {
  const secret = getServerEnv().WHATSAPP_APP_SECRET;
  if (!secret || !signatureHeader?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const given = signatureHeader.slice(7);
  const left = Buffer.from(expected);
  const right = Buffer.from(given);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function normalizeWhatsAppMessage(
  input: z.infer<typeof whatsappMessageSchema>,
  userId: string,
): NormalizedMessage | null {
  const content = input.text?.body?.trim() ?? "";
  if (!content) return null;
  return {
    id: `whatsapp:${input.id}`,
    userId,
    provider: "WHATSAPP",
    externalMessageId: input.id,
    conversationId: input.from ?? input.id,
    sender: input.from ?? "WhatsApp",
    recipient: "STILL",
    timestamp: input.timestamp ? new Date(Number(input.timestamp) * 1000) : new Date(),
    content,
    attachmentsMetadata: null,
    sourceUrl: null,
    permissionsContext: "official_cloud_api_only",
    isFromUser: true,
  };
}

export const WhatsAppAdapter: ProviderAdapter = {
  id: "WHATSAPP",
  getCapabilities: whatsappCapability,
  normalizeMessage(input, userId) {
    const parsed = whatsappMessageSchema.safeParse(input);
    if (!parsed.success) return null;
    return normalizeWhatsAppMessage(parsed.data, userId);
  },
};
