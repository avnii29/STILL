import { describe, expect, it } from "vitest";
import { extractCommitment } from "@/lib/agents/extract";
import { findConnectedThread, shouldOfferLongTermKeep, significantTokens } from "@/lib/guest/relate";
import type { GuestThread } from "@/lib/guest/types";

function thread(partial: Partial<GuestThread> = {}): GuestThread {
  return {
    id: "g_mum",
    note: "I'll call mum Sunday.",
    title: "call mum",
    person: "mum",
    deadline: "sunday",
    dueAt: null,
    evidence: "I'll call mum Sunday.",
    confidence: 0.8,
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

describe("guest continuity", () => {
  it("tokens a call-mum sentence", () => {
    expect(significantTokens("I'll call mum Sunday.")).toEqual(expect.arrayContaining(["call", "mum", "sunday"]));
  });

  it("offers long-term keep only after three live threads", () => {
    expect(shouldOfferLongTermKeep([thread()])).toBe(false);
    expect(
      shouldOfferLongTermKeep([
        thread({ id: "g_1" }),
        thread({ id: "g_2" }),
        thread({ id: "g_3" }),
      ]),
    ).toBe(true);
  });

  it("connects a later Saturday change to the Sunday call", () => {
    const extraction = extractCommitment({ text: "Actually I'll call her Saturday instead." });
    const found = findConnectedThread("Actually I'll call her Saturday instead.", extraction, [thread()]);
    expect(found?.kind).toBe("update");
    expect(found?.thread.id).toBe("g_mum");
  });

  it("asks before closing a thread that sounds done", () => {
    const extraction = extractCommitment({ text: "Called her :)" });
    const found = findConnectedThread("Called her :)", extraction, [thread()]);
    expect(found?.kind).toBe("resolve");
    expect(found?.thread.id).toBe("g_mum");
  });
});
