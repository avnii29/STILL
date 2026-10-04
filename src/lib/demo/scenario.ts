import { runStillLoop, type StillLoopResult } from "@/lib/agents/orchestrator";

export const DEMO_CAPTURE_AT = new Date("2026-10-04T05:12:00.000Z");
export const DEMO_FORWARD_AT = new Date("2026-10-06T09:30:00.000Z");
export const DEMO_TIME_ZONE = "Asia/Kolkata";

export const DEMO_CONVERSATION = `Alex: Can you get the revised dataset to Maya by Tuesday?
Me: Yep, I'll get it to her by Tuesday evening.`;

export const DEMO_FOLLOW_UP = "Maya: Friday is completely fine.";

const DEMO_EVENT = {
  title: "4:00 PM — Catch-up",
  startsAt: "2026-10-06T10:30:00.000Z",
  endsAt: "2026-10-06T11:00:00.000Z",
  important: false,
};

export type DemoStage = "capture" | "forward" | "followup" | "approve";

export function runDemoStage(stage: DemoStage): StillLoopResult & { label: string; stage: DemoStage } {
  const calendarConnected = false;
  const base = {
    timeZone: DEMO_TIME_ZONE,
    calendarEvents: [DEMO_EVENT],
    calendarConnected,
  };
  if (stage === "followup") {
    const result = runStillLoop({ ...base, text: DEMO_FOLLOW_UP, now: DEMO_FORWARD_AT });
    return {
      ...result,
      stage,
      label: "Demo scenario. Nothing was written to your account.",
      deadlineChange: result.deadlineChange
        ? { from: "Tuesday evening", to: result.deadlineChange.to }
        : null,
    };
  }
  if (stage === "approve" || stage === "forward") {
    const captured = runStillLoop({
      ...base,
      text: DEMO_CONVERSATION,
      now: DEMO_CAPTURE_AT,
    });
    const result = runStillLoop({
      ...base,
      text: "Yep, I'll get it to her by Tuesday evening.",
      now: DEMO_FORWARD_AT,
      approved: stage === "approve",
      knownDueAt: captured.commitment?.dueAt,
    });
    return { ...result, stage, label: "Demo scenario. Nothing was written to your account." };
  }
  const result = runStillLoop({
    ...base,
    text: DEMO_CONVERSATION,
    now: DEMO_CAPTURE_AT,
  });
  return { ...result, stage, label: "Demo scenario. Nothing was written to your account." };
}
