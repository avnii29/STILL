import type { DetectionResult } from "@/lib/agents/types";

export function runFutureSelfAgent(detection: DetectionResult): DetectionResult {
  const selfDirected =
    detection.owner === "SELF" ||
    detection.type === "SELF_COMMITMENT" ||
    detection.type === "REMINDER_REQUEST";

  if (!selfDirected) return detection;

  return {
    ...detection,
    owner: "SELF",
    current_state: `${detection.current_state} This looks like something you said to yourself, not a social obligation.`,
    suggested_action:
      detection.suggested_action ||
      "Keep it only if your future self would thank you for the reminder.",
  };
}
