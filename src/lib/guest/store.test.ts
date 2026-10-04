import { describe, expect, it } from "vitest";
import { emptyGuestWorkspace, parseGuestWorkspace } from "@/lib/guest/parse";
import { shouldOfferLongTermKeep } from "@/lib/guest/relate";
import type { GuestThread } from "@/lib/guest/types";

function thread(partial: Partial<GuestThread> = {}): GuestThread {
  return {
    id: "g_test",
    note: "I'll send the report tomorrow.",
    title: "send report",
    person: null,
    deadline: "tomorrow",
    dueAt: "2026-09-26T09:00:00.000Z",
    evidence: "I'll send the report tomorrow.",
    confidence: 0.88,
    uncertain: false,
    isCommitment: true,
    sourceKind: "TEXT",
    status: "OPEN",
    createdAt: "2026-09-25T10:00:00.000Z",
    postponedUntil: null,
    resolvedAt: null,
    ...partial,
  };
}

describe("guest workspace parse", () => {
  it("drops expired guest storage", () => {
    const parsed = parseGuestWorkspace(
      {
        version: 1,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        threads: [thread()],
        openedAny: true,
        postponedAny: false,
      },
      new Date("2026-09-25T00:00:00.000Z"),
    );
    expect(parsed).toBeNull();
  });

  it("keeps a valid workspace and ignores a forged id", () => {
    const parsed = parseGuestWorkspace(
      {
        ...emptyGuestWorkspace(new Date("2026-09-25T10:00:00.000Z")),
        threads: [thread(), { ...thread(), id: "not-guest" }],
      },
      new Date("2026-09-25T12:00:00.000Z"),
    );
    expect(parsed?.threads).toHaveLength(1);
    expect(parsed?.threads[0]?.id).toBe("g_test");
  });

  it("does not offer an account wall after one or two threads", () => {
    expect(shouldOfferLongTermKeep([thread()])).toBe(false);
    expect(shouldOfferLongTermKeep([thread({ id: "g_one" }), thread({ id: "g_two" })])).toBe(false);
  });
});
