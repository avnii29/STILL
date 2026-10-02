import type { AgentMessage, ConversationSlice } from "@/lib/agents/types";

export function parseConversationText(text: string): AgentMessage[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const parsed: AgentMessage[] = [];
  const speakerPattern = /^([A-Za-z][A-Za-z0-9 .'-]{0,40})\s*[:\-—]\s*(.+)$/;

  for (const line of lines) {
    const match = line.match(speakerPattern);
    if (match) {
      const speaker = match[1].trim();
      const isFromUser = /^(me|i|myself)$/i.test(speaker);
      parsed.push({
        speaker: isFromUser ? "Me" : speaker,
        body: match[2].trim(),
        isFromUser,
      });
    } else if (parsed.length > 0) {
      parsed[parsed.length - 1].body += ` ${line}`;
    } else {
      parsed.push({ speaker: "Unknown", body: line, isFromUser: false });
    }
  }

  return parsed;
}

export function sliceAround(
  messages: AgentMessage[],
  index: number,
  radius = 3,
): ConversationSlice {
  const start = Math.max(0, index - radius);
  const end = Math.min(messages.length, index + radius + 1);
  return {
    messages: messages.slice(start, end),
    focusIndex: index - start,
  };
}

export function formatSlice(slice: ConversationSlice) {
  return slice.messages
    .map((message, index) => {
      const mark = index === slice.focusIndex ? ">> " : "   ";
      return `${mark}${message.speaker}: ${message.body}`;
    })
    .join("\n");
}
