import { describe, expect, it } from "vitest";
import { gateAction } from "@/lib/actions/gateway";
import { runDeadlineAgent } from "@/lib/agents/deadline-agent";
import { runDemoStage } from "@/lib/demo/scenario";
import { runStillLoop } from "@/lib/agents/orchestrator";
import { detectCommitment } from "@/lib/sources/detect";

const now = new Date("2026-10-04T05:12:00.000Z");
const tz = "Asia/Kolkata";

const EVALS: { text: string; hard: boolean }[] = [
  { text: "I'll send it tomorrow.", hard: true },
  { text: "We should meet sometime.", hard: false },
  { text: "Maybe I'll send it later.", hard: false },
  { text: "I'll definitely submit the form tonight.", hard: true },
  { text: "If I have time, I'll do it.", hard: false },
  { text: "Can you remind me tomorrow?", hard: true },
  { text: "Yep, I'll get the revised dataset to Maya by Tuesday evening.", hard: true },
];

describe("deadline agent", () => {
  it("keeps evening as a part of the day", () => {
    const result = runDeadlineAgent({
      text: "I'll send it Tuesday evening.",
      now,
      timeZone: tz,
    });
    expect(result.precision).toBe("DAY_PART");
    expect(result.dueAt).toBeTruthy();
  });

  it("does not invent a deadline for later", () => {
    const result = runDeadlineAgent({ text: "I'll send it later.", now, timeZone: tz });
    expect(result.dueAt).toBeNull();
    expect(result.precision).toBe("UNSPECIFIED");
  });
});

describe("commitment eval", () => {
  it("measures hard commitments separately from maybes", () => {
    let tp = 0;
    let fp = 0;
    let fn = 0;
    for (const item of EVALS) {
      const detected = detectCommitment({ text: item.text, now, timeZone: tz });
      const predicted =
        detected.classification === "COMMITMENT" || detected.classification === "REMINDER_REQUEST";
      if (predicted && item.hard) tp += 1;
      else if (predicted && !item.hard) fp += 1;
      else if (!predicted && item.hard) fn += 1;
    }
    const precision = tp / (tp + fp);
    const recall = tp / (tp + fn);
    expect(fp).toBe(0);
    expect(precision).toBe(1);
    expect(recall).toBeGreaterThanOrEqual(0.75);
  });
});

describe("still loop", () => {
  it("finds the dataset promise and pauses before a calendar move", () => {
    const capture = runDemoStage("capture");
    expect(capture.commitment?.person).toBe("Maya");
    expect(capture.commitment?.evidence).toContain("Tuesday evening");
    expect(capture.commitment?.precision).toBe("DAY_PART");
    expect(capture.proposal).toBeNull();

    const forward = runDemoStage("forward");
    expect(forward.proposal?.title).toContain("Catch-up");
    expect(forward.gate?.status).toBe("PAUSED");

    const approved = runDemoStage("approve");
    expect(approved.gate?.allowed).toBe(false);
    expect(approved.gate?.reason.toLowerCase()).toContain("not connected");

    const follow = runDemoStage("followup");
    expect(follow.intervention.intervene).toBe(false);
    expect(follow.deadlineChange?.to.toLowerCase()).toContain("friday");
  });

  it("blocks an important event and a sent message", () => {
    const blocked = runStillLoop({
      text: "Yep, I'll get the revised dataset to Maya by Tuesday evening.",
      now: new Date("2026-10-06T09:30:00.000Z"),
      timeZone: tz,
      knownDueAt: new Date("2026-10-06T12:30:00.000Z").toISOString(),
      calendarEvents: [
        {
          title: "Interview",
          startsAt: "2026-10-06T10:30:00.000Z",
          endsAt: "2026-10-06T11:00:00.000Z",
          important: true,
        },
      ],
      approved: true,
      calendarConnected: true,
    });
    expect(blocked.gate?.status).toBe("BLOCKED");
    expect(gateAction({
      kind: "SEND_MESSAGE",
      evidence: "hello",
      stillActive: true,
      approved: true,
    }).status).toBe("BLOCKED");
  });
});
