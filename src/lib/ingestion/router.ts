import type { ContentRoute } from "@/lib/ingestion/types";

const WEEKDAY =
  "(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|tonight|next week)";

const CANCEL =
  /\b(never mind|nevermind|no longer need(?:ed)?|cancel(?:led)?|forget it|don'?t worry about it|do not worry about it)\b/i;

const PAST_ACTION =
  /\b(sent|submitted|finished|completed|shared|delivered|emailed|paid|done)\b/i;

const FUTURE =
  /\b(i(?:'ll| will)|i am going to|i'm going to|going to|i promise)\b/i;

const RESCHEDULE_WORD = /\b(actually|instead|moved to|push(?:ed)? to)\b/i;

export function routeContent(text: string): ContentRoute {
  const value = text.replace(/\s+/g, " ").trim();
  if (!value) return "ignore";
  if (CANCEL.test(value)) return "cancellation";
  if (isDeadlineChange(value)) return "deadline_change";
  if (PAST_ACTION.test(value) && !FUTURE.test(value)) return "fulfillment";
  if (FUTURE.test(value)) return "new_commitment";
  if (new RegExp(`\\b${WEEKDAY}\\b`, "i").test(value)) return "context_update";
  return "ignore";
}

function isDeadlineChange(value: string) {
  const when = new RegExp(`\\b${WEEKDAY}\\b`, "i");
  if (RESCHEDULE_WORD.test(value) && when.test(value)) return true;
  if (new RegExp(`\\b${WEEKDAY}\\b.{0,40}\\b(?:works|is(?! not)(?: \\w+){0,2} fine|is ok|is okay)\\b`, "i").test(value)) {
    return true;
  }
  return false;
}

export function shouldInterrupt(route: ContentRoute): { interrupt: boolean; reason: string } {
  if (route === "ignore") {
    return { interrupt: false, reason: "No commitment signal." };
  }
  if (route === "context_update") {
    return { interrupt: false, reason: "Context updated but no user action required." };
  }
  if (route === "new_commitment") {
    return { interrupt: true, reason: "Possible commitment." };
  }
  if (route === "fulfillment") {
    return { interrupt: true, reason: "Possible fulfillment." };
  }
  if (route === "deadline_change") {
    return { interrupt: true, reason: "Possible deadline change." };
  }
  return { interrupt: true, reason: "Possible cancellation." };
}
