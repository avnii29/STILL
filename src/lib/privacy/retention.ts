export type ConversationRetention = "NONE" | "EVIDENCE_ONLY" | "RETAIN_SOURCE";

export function normalizeRetention(value?: string | null): ConversationRetention {
  if (value === "NONE" || value === "RETAIN_SOURCE" || value === "EVIDENCE_ONLY") return value;
  return "EVIDENCE_ONLY";
}

export function messagesForRetention<T extends { body: string }>(
  messages: T[],
  evidenceTexts: string[],
  retention: string,
): T[] {
  const mode = normalizeRetention(retention);
  if (mode === "RETAIN_SOURCE") return messages;
  if (mode === "NONE") return [];
  const needles = evidenceTexts.map((item) => item.trim()).filter(Boolean);
  if (needles.length === 0) return messages.slice(0, 1);
  const kept = messages.filter((message) =>
    needles.some(
      (evidence) => message.body.includes(evidence) || evidence.includes(message.body),
    ),
  );
  return kept.length > 0 ? kept : messages.slice(0, 1);
}

export function excerptForRetention(fullText: string, evidenceTexts: string[], retention: string) {
  const mode = normalizeRetention(retention);
  if (mode === "NONE") return null;
  if (mode === "RETAIN_SOURCE") return fullText.slice(0, 4000);
  const evidence = evidenceTexts.find((item) => item.trim()) ?? fullText;
  return evidence.slice(0, 4000);
}
