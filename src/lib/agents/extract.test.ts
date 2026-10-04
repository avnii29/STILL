import { describe, expect, it } from "vitest";
import { extractCommitment, extractPerson, scheduleRemindAt } from "@/lib/agents/extract";
import { evaluateIntervention, evaluatePostponement, redTeamExternalAction } from "@/lib/threads/lifecycle";
import { isPublicPath } from "@/lib/supabase/proxy";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const now = new Date("2026-09-21T10:00:00");

describe("commitment extraction", () => {
  it("extracts an explicit promise with person and deadline", () => {
    const result = extractCommitment({
      text: "I'll send Priya the project report tomorrow evening.",
      now,
    });
    expect(result.is_commitment).toBe(true);
    expect(result.person).toBe("Priya");
    expect(result.deadline).toBe("tomorrow evening");
    expect(result.normalized_commitment.toLowerCase()).toContain("send");
    expect(result.normalized_commitment.toLowerCase()).toContain("report");
    expect(result.evidence).toContain("Priya");
    expect(result.due_at).toBeTruthy();
  });

  it("understands I'll send the report tomorrow", () => {
    const result = extractCommitment({
      text: "I'll send the report tomorrow.",
      now,
    });
    expect(result.is_commitment).toBe(true);
    expect(result.deadline).toBe("tomorrow");
    expect(result.normalized_commitment.toLowerCase()).toContain("send");
    expect(result.normalized_commitment.toLowerCase()).toContain("report");
  });

  it("keeps the Rahul dataset example", () => {
    const result = extractCommitment({
      text: "I'll send Rahul the revised dataset tomorrow.",
      now,
    });
    expect(result.is_commitment).toBe(true);
    expect(result.person).toBe("Rahul");
    expect(result.deadline).toBe("tomorrow");
  });

  it("does not treat coffee sometime as a commitment", () => {
    const result = extractCommitment({
      text: "We should get coffee sometime.",
      now,
    });
    expect(result.is_commitment).toBe(false);
    expect(result.uncertain).toBe(false);
  });

  it("marks thinking-apply as uncertain rather than confirmed", () => {
    const result = extractCommitment({
      text: "I'm thinking I'll apply next week.",
      now,
    });
    expect(result.is_commitment).toBe(false);
    expect(result.uncertain).toBe(true);
    expect(result.confidence).toBeLessThan(0.5);
  });

  it("extracts tonight as a deadline", () => {
    const result = extractCommitment({
      text: "I'll send the report tonight.",
      now,
    });
    expect(result.is_commitment).toBe(true);
    expect(result.deadline).toBe("tonight");
    expect(result.deadline_confidence).toBeGreaterThan(0.7);
  });

  it("treats 'get X to Maya by Tuesday evening' as a commitment with an evening deadline", () => {
    const result = extractCommitment({
      text: "Yep, I'll get the revised dataset to Maya by Tuesday evening.",
      now,
    });
    expect(result.is_commitment).toBe(true);
    expect(result.person).toBe("Maya");
    expect(result.deadline).toBe("tuesday evening");
    expect(new Date(result.due_at!).getHours()).toBe(18);
    expect(result.normalized_commitment).toBe("get revised dataset");
  });

  it("does not treat You as a person", () => {
    expect(extractPerson("I'll send you the PDF tonight.")).toBeNull();
  });

  it("treats 'I'll try to get to it' as not a commitment", () => {
    const result = extractCommitment({ text: "I'll try to get to it", now });
    expect(result.is_commitment).toBe(false);
    expect(result.confidence).toBeLessThan(0.5);
  });

  it("treats 'maybe someday' as not a commitment", () => {
    const result = extractCommitment({ text: "maybe someday", now });
    expect(result.is_commitment).toBe(false);
    expect(result.confidence).toBeLessThan(0.5);
  });

  it("reads a short yes plus a deadline as a commitment when the context names the person", () => {
    const result = extractCommitment({
      text: "yep, Tuesday evening",
      context: "I'll get the revised dataset to Maya",
      now,
    });
    expect(result.is_commitment).toBe(true);
    expect(result.person).toBe("Maya");
    expect(result.deadline).toBe("tuesday evening");
    expect(new Date(result.due_at!).getHours()).toBe(18);
  });
});

describe("postponement and intervention", () => {
  it("proposes moving a same-day event on the first postpone and leaves the slot for approval", () => {
    const result = evaluateIntervention({
      dueAt: new Date("2026-10-06T12:30:00.000Z"),
      postponementCount: 1,
      calendarConnected: false,
      hasConflict: true,
      latestEvidence: "Yep, I'll get the revised dataset to Maya by Tuesday evening.",
      now: new Date("2026-10-05T08:00:00.000Z"),
      events: [
        {
          id: "evt",
          title: "Catch-up",
          startsAt: "2026-10-06T10:30:00.000Z",
          endsAt: "2026-10-06T11:00:00.000Z",
          calendarId: "local",
          source: "local",
        },
      ],
    });
    expect(result.intervene).toBe(true);
    expect(result.proposedMove?.title).toBe("Catch-up");
    expect(result.proposedMove?.start).toBe("2026-10-06T11:30:00.000Z");
    expect(result.suggestedAction.toLowerCase()).toContain("nothing moves until you approve");
  });

  it("does not propose a move on a first postpone when the day is empty", () => {
    const result = evaluateIntervention({
      dueAt: new Date("2026-10-20T12:30:00.000Z"),
      postponementCount: 1,
      calendarConnected: false,
      hasConflict: false,
      latestEvidence: "I'll send the report tomorrow.",
      now: new Date("2026-10-05T08:00:00.000Z"),
      events: [],
    });
    expect(result.proposedMove).toBeNull();
    expect(result.intervene).toBe(false);
  });

  it("asks to move the deadline on first postponement", () => {
    const first = evaluatePostponement(0);
    expect(first.count).toBe(1);
    expect(first.kind).toBe("MOVE_DEADLINE");
  });

  it("asks for a smaller step on the second postponement", () => {
    const second = evaluatePostponement(1);
    expect(second.kind).toBe("SMALLER_STEP");
    expect(second.prompt.toLowerCase()).toContain("twice");
  });

  it("suggests a micro-action on the third postponement", () => {
    const third = evaluatePostponement(2);
    expect(third.kind).toBe("MICRO_ACTION");
    expect(third.suggestedAction.toLowerCase()).toContain("first three lines");
  });

  it("intervenes when a deadline is close", () => {
    const due = new Date(now.getTime() + 3 * 3600_000);
    const result = evaluateIntervention({
      dueAt: due,
      postponementCount: 0,
      calendarConnected: false,
      hasConflict: false,
      latestEvidence: "I'll send the report tonight.",
      now,
    });
    expect(result.intervene).toBe(true);
    expect(result.status).toBe("APPROACHING");
    expect(result.requiresApproval).toBe(true);
  });

  it("stays quiet when nothing is due", () => {
    const result = evaluateIntervention({
      dueAt: new Date(now.getTime() + 10 * 24 * 3600_000),
      postponementCount: 0,
      calendarConnected: false,
      hasConflict: false,
      latestEvidence: "I'll write this someday after the move.",
      now,
    });
    expect(result.intervene).toBe(false);
  });
});

describe("red team", () => {
  it("blocks moving an interview", () => {
    const verdict = redTeamExternalAction({
      proposal: "MOVE 4 PM EVENT",
      evidence: "This event contains an interview link.",
      stillActive: true,
    });
    expect(verdict.allowed).toBe(false);
    expect(verdict.blockedReason?.toLowerCase()).toContain("interview");
  });

  it("blocks a meeting, a call, and a high-priority event", () => {
    for (const title of ["Weekly meeting", "Client call"]) {
      const verdict = redTeamExternalAction({
        proposal: `MOVE ${title}`,
        evidence: "Yep, I'll get the revised dataset to Maya by Tuesday evening.",
        stillActive: true,
        eventTitle: title,
      });
      expect(verdict.allowed).toBe(false);
    }
    const high = redTeamExternalAction({
      proposal: "MOVE Catch-up",
      evidence: "Yep, I'll get the revised dataset to Maya by Tuesday evening.",
      stillActive: true,
      eventTitle: "Catch-up",
      priority: "high",
    });
    expect(high.allowed).toBe(false);
  });

  it("allows a reversible non-interview action that is still active", () => {
    const verdict = redTeamExternalAction({
      proposal: "MOVE_DEADLINE send report",
      evidence: "I'll send the report tomorrow.",
      stillActive: true,
    });
    expect(verdict.allowed).toBe(true);
  });
});

describe("reminder scheduling", () => {
  it("schedules two hours before a distant deadline", () => {
    const due = new Date("2026-09-21T20:00:00");
    const remind = scheduleRemindAt(due, now);
    expect(remind.getHours()).toBe(18);
  });
});

describe("authorization surface", () => {
  it("keeps public auth and extract routes public", () => {
    expect(isPublicPath("/")).toBe(true);
    expect(isPublicPath("/auth/sign-in")).toBe(true);
    expect(isPublicPath("/auth/sign-up")).toBe(true);
    expect(isPublicPath("/auth/forgot-password")).toBe(true);
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/signup")).toBe(true);
    expect(isPublicPath("/forgot-password")).toBe(true);
    expect(isPublicPath("/reset-password")).toBe(true);
    expect(isPublicPath("/api/extract")).toBe(true);
    expect(isPublicPath("/try")).toBe(true);
    expect(isPublicPath("/still")).toBe(true);
    expect(isPublicPath("/still/keep")).toBe(true);
    expect(isPublicPath("/still/memory")).toBe(true);
    expect(isPublicPath("/still/privacy")).toBe(true);
    expect(isPublicPath("/still/threads/g_example")).toBe(true);
    expect(isPublicPath("/home")).toBe(false);
    expect(isPublicPath("/app")).toBe(false);
    expect(isPublicPath("/threads")).toBe(false);
  });
});

describe("RLS policy file", () => {
  it("covers every user-owned table", () => {
    const sql = readFileSync(resolve(process.cwd(), "prisma/sql/rls.sql"), "utf8");
    for (const table of [
      "users",
      "profiles",
      "people",
      "conversation_sources",
      "conversations",
      "messages",
      "threads",
      "commitments",
      "commitment_evidence",
      "thread_events",
      "resolutions",
      "reminders",
      "notifications",
      "user_preferences",
      "integrations",
      "audit_logs",
      "push_subscriptions",
      "agent_runs",
      "interventions",
      "action_proposals",
      "action_approvals",
      "integration_accounts",
      "source_permissions",
      "source_conversations",
      "source_messages",
      "memory_candidates",
      "provider_events",
      "ingestion_events",
      "calendar_events",
    ]) {
      expect(sql).toContain(`alter table ${table} enable row level security`);
    }
  });
});
