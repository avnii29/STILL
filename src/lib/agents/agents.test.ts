import { describe, expect, it } from "vitest";
import {
  detectCommitmentHeuristic,
  heuristicDetection,
} from "@/lib/agents/commitment-detector";
import { heuristicSocialAdvice } from "@/lib/agents/social-context-agent";
import { parseConversationText } from "@/lib/agents/ingestion";
import { runFutureSelfAgent } from "@/lib/agents/future-self-agent";
import { runSuggestionAgent } from "@/lib/agents/suggestion-agent";
import { heuristicResolution } from "@/lib/agents/resolution-agent";
import { extractJsonObject } from "@/lib/agents/json";
import { detectThreadsFromMessages } from "@/lib/agents/pipeline";
import type { DetectionResult } from "@/lib/agents/types";

describe("parseConversationText", () => {
  it("reads speaker lines", () => {
    const messages = parseConversationText(
      "Me: I'll send you the PDF tonight.\nSam: Thank you.",
    );
    expect(messages).toHaveLength(2);
    expect(messages[0]?.isFromUser).toBe(true);
    expect(messages[1]?.speaker).toBe("Sam");
  });
});

describe("commitment detector", () => {
  it("treats an explicit promise as a thread", () => {
    const hit = detectCommitmentHeuristic({
      speaker: "Me",
      body: "I'll send you the PDF tonight.",
      isFromUser: true,
    });
    expect(hit?.type).toBe("EXPLICIT_PROMISE");
    expect(hit?.owner).toBe("ME");
    expect((hit?.confidence ?? 0) > 0.6).toBe(true);
  });

  it("does not treat idle someday-talk as a living thread", () => {
    const detection = heuristicDetection(
      {
        speaker: "Me",
        body: "Yeah we should totally do that someday.",
        isFromUser: true,
      },
      "casual chat",
    );
    expect(detection?.is_thread).toBe(false);
    expect(detection?.needs_user_review).toBe(true);
  });

  it("keeps a reminder request", () => {
    const hit = detectCommitmentHeuristic({
      speaker: "Me",
      body: "Remind me to tell Amma.",
      isFromUser: true,
    });
    expect(hit?.type).toBe("REMINDER_REQUEST");
  });
});

describe("social context", () => {
  it("refuses to surface vague atmosphere", () => {
    const advice = heuristicSocialAdvice({
      type: "RECIPROCAL_PLAN",
      confidence: 0.28,
      evidence: "Yeah we should totally do that someday",
    });
    expect(advice.shouldSurface).toBe(false);
    expect(advice.caution.toLowerCase()).toContain("not claiming");
  });
});

describe("future-self and suggestion", () => {
  const base: DetectionResult = {
    is_thread: true,
    confidence: 0.8,
    type: "SELF_COMMITMENT",
    evidence: "After this semester I'll finally build that project.",
    context: "said to myself",
    current_state: "unfinished",
    suggested_action: "Decide if this still matters.",
    needs_user_review: true,
    title: "build that project",
    owner: "SELF",
    meta: { interpretedBy: "heuristic", provider: "none" },
  };

  it("marks self commitments as future-self", () => {
    const result = runFutureSelfAgent(base);
    expect(result.owner).toBe("SELF");
    expect(result.current_state.toLowerCase()).toContain("yourself");
  });

  it("never auto-contacts another human", () => {
    const suggestion = runSuggestionAgent({ ...base, owner: "THEM", type: "EXPLICIT_PROMISE" });
    expect(suggestion.requiresUserApproval).toBe(true);
    expect(suggestion.wouldContactAnotherHuman).toBe(true);
  });
});

describe("resolution", () => {
  it("notices later fulfillment language without claiming proof", () => {
    const look = heuristicResolution({
      original: "I'll send the money tomorrow.",
      laterMessages: ["Me: sent it just now."],
    });
    expect(look.likelyResolved).toBe(true);
    expect(look.uncertainty.toLowerCase()).toContain("guess");
  });
});

describe("json extraction", () => {
  it("reads fenced json", () => {
    const value = extractJsonObject('```json\n{"is_thread":true}\n```');
    expect(value).toEqual({ is_thread: true });
  });
});

describe("pipeline", () => {
  it("surfaces an explicit promise and leaves idle someday-talk quiet", async () => {
    const results = await detectThreadsFromMessages({
      messages: [
        { speaker: "Me", body: "I'll send you the PDF tonight.", isFromUser: true },
        { speaker: "Sam", body: "Thank you.", isFromUser: false },
        { speaker: "Me", body: "Yeah we should totally do that someday.", isFromUser: true },
      ],
      model: null,
    });

    const surfaced = results.filter((item) => item.shouldSurface);
    expect(surfaced.some((item) => item.evidence.includes("PDF"))).toBe(true);
    expect(surfaced.some((item) => item.evidence.toLowerCase().includes("someday"))).toBe(
      false,
    );
  });

  it("does not treat coffee sometime as a commitment", async () => {
    const results = await detectThreadsFromMessages({
      messages: [
        { speaker: "Me", body: "We should get coffee sometime.", isFromUser: true },
        { speaker: "Me", body: "I'll send the report tonight.", isFromUser: true },
      ],
      model: null,
    });
    const surfaced = results.filter((item) => item.shouldSurface);
    expect(surfaced.some((item) => item.evidence.toLowerCase().includes("coffee"))).toBe(false);
    expect(surfaced.some((item) => item.evidence.toLowerCase().includes("report"))).toBe(true);
  });
});
