import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { getServerEnv } from "@/lib/env";
import { instagramCapability } from "@/lib/sources/capabilities";
import type { NormalizedMessage, ProviderAdapter } from "@/lib/sources/types";

const instagramMessageSchema = z.object({
  mid: z.string().optional(),
  id: z.string().optional(),
  text: z.string().optional(),
  from: z.object({ id: z.string().optional() }).optional(),
});

export function verifyInstagramSignature(rawBody: string, signatureHeader: string | null) {
  const secret = getServerEnv().INSTAGRAM_APP_SECRET;
  if (!secret || !signatureHeader?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const given = signatureHeader.slice(7);
  const left = Buffer.from(expected);
  const right = Buffer.from(given);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function normalizeInstagramMessage(
  input: z.infer<typeof instagramMessageSchema>,
  userId: string,
): NormalizedMessage | null {
  const content = input.text?.trim() ?? "";
  const id = input.mid ?? input.id;
  if (!content || !id) return null;
  return {
    id: `instagram:${id}`,
    userId,
    provider: "INSTAGRAM",
    externalMessageId: id,
    conversationId: input.from?.id ?? id,
    sender: input.from?.id ?? "Instagram",
    recipient: "STILL",
    timestamp: new Date(),
    content,
    attachmentsMetadata: null,
    sourceUrl: null,
    permissionsContext: "official_messaging_api_only",
    isFromUser: true,
  };
}

export const InstagramAdapter: ProviderAdapter = {
  id: "INSTAGRAM",
  getCapabilities: instagramCapability,
  normalizeMessage(input, userId) {
    const parsed = instagramMessageSchema.safeParse(input);
    if (!parsed.success) return null;
    return normalizeInstagramMessage(parsed.data, userId);
  },
};
