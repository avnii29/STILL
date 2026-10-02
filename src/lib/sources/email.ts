import { z } from "zod";
import { emailCapability } from "@/lib/sources/capabilities";
import type { NormalizedMessage, ProviderAdapter } from "@/lib/sources/types";

const emailMessageSchema = z.object({
  id: z.string(),
  threadId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  date: z.string().optional(),
  snippet: z.string().optional(),
  body: z.string().optional(),
});

export function normalizeEmailMessage(
  input: z.infer<typeof emailMessageSchema>,
  userId: string,
): NormalizedMessage | null {
  const content = (input.body ?? input.snippet ?? "").trim();
  if (!content) return null;
  return {
    id: `email:${input.id}`,
    userId,
    provider: "EMAIL",
    externalMessageId: input.id,
    conversationId: input.threadId ?? input.id,
    sender: input.from ?? "Email",
    recipient: input.to ?? null,
    timestamp: input.date ? new Date(input.date) : new Date(),
    content,
    attachmentsMetadata: null,
    sourceUrl: null,
    permissionsContext: "authorized_mailbox_only",
    isFromUser: true,
  };
}

export const EmailAdapter: ProviderAdapter = {
  id: "EMAIL",
  getCapabilities: emailCapability,
  normalizeMessage(input, userId) {
    const parsed = emailMessageSchema.safeParse(input);
    if (!parsed.success) return null;
    return normalizeEmailMessage(parsed.data, userId);
  },
};
