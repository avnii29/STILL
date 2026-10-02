import type { DetectionResult, Suggestion } from "@/lib/agents/types";
import { NO_AUTO_MESSAGE } from "@/lib/copy";

export { NO_AUTO_MESSAGE };

export function runSuggestionAgent(detection: DetectionResult): Suggestion {
  const social =
    detection.owner === "THEM" ||
    detection.owner === "SHARED" ||
    detection.type === "RECIPROCAL_PLAN";

  if (social) {
    return {
      action: detection.suggested_action,
      requiresUserApproval: true,
      wouldContactAnotherHuman: true,
    };
  }

  return {
    action: detection.suggested_action,
    requiresUserApproval: true,
    wouldContactAnotherHuman: false,
  };
}
