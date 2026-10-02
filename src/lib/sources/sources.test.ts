import { describe, expect, it } from "vitest";
import { extractCommitment } from "@/lib/agents/extract";
import { detectCommitment, scoreRelevance } from "@/lib/sources/detect";
import { canIngest } from "@/lib/sources/permission";
import { telegramStartCode, normalizeTelegramMessage } from "@/lib/sources/telegram";
import { resolveTemporal, zonedDate } from "@/lib/sources/temporal";
import { bestThreadMatch } from "@/lib/sources/thread-match";
import { WhatsAppAdapter } from "@/lib/sources/whatsapp";
import { isPublicPath } from "@/lib/supabase/proxy";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const now = new Date("2026-09-21T10:00:00+05:30");
const tz = "Asia/Kolkata";

describe("commitment detection language", () => {
  it("treats an explicit promise as a commitment", () => {
    const result = detectCommitment({
      text: "I'll send the report tomorrow.",
      now,
      timeZone: tz,
    });
    expect(result.classification).toBe("COMMITMENT");
    expect(result.actor).toBe("ME");
  });

  it("does not treat a request as the user's commitment", () => {
    const result = detectCommitment({
      text: "Can you send the report tomorrow?",
      now,
      timeZone: tz,
    });
    expect(result.classification).toBe("NON_COMMITMENT");
  });

  it("keeps casual coffee as non-commitment", () => {
    const result = detectCommitment({
      text: "We should get coffee sometime.",
      now,
      timeZone: tz,
    });
    expect(result.classification).toBe("NON_COMMITMENT");
  });

  it("marks hedges as possible commitments", () => {
    const result = detectCommitment({
      text: "I might finish it tomorrow.",
      now,
      timeZone: tz,
    });
    expect(result.classification).toBe("POSSIBLE_COMMITMENT");
  });

  it("does not remember negated plans", () => {
    const result = detectCommitment({
      text: "I don't think I'll finish it tomorrow.",
      now,
      timeZone: tz,
    });
    expect(result.classification).toBe("NON_COMMITMENT");
  });

  it("treats another person's promise as external", () => {
    const result = detectCommitment({
      text: "Rahul said he'll send it tomorrow.",
      now,
      timeZone: tz,
    });
    expect(result.classification).toBe("EXTERNAL_COMMITMENT");
  });

  it("treats explicit reminders as reminder requests", () => {
    const result = detectCommitment({
      text: "Remind me tomorrow at 9 to submit the application.",
      now,
      timeZone: tz,
    });
    expect(result.classification).toBe("REMINDER_REQUEST");
    expect(result.due_at).toBeTruthy();
    expect(result.ask_when).toBe(false);
  });

  it("asks when later has no time", () => {
    const result = detectCommitment({
      text: "Remind me later to call Dad.",
      now,
      timeZone: tz,
    });
    expect(result.classification).toBe("REMINDER_REQUEST");
    expect(result.ask_when).toBe(true);
  });
});

describe("extract commitment alignment", () => {
  it("rejects negated and requested wording", () => {
    expect(
      extractCommitment({ text: "I don't think I'll finish it tomorrow.", now }).is_commitment,
    ).toBe(false);
    expect(
      extractCommitment({ text: "Can you send the report tomorrow?", now }).is_commitment,
    ).toBe(false);
  });
});

describe("relevance", () => {
  it("scores an explicit promise high", () => {
    expect(scoreRelevance("I'll send it tomorrow.")).toBe("HIGH");
  });

  it("scores idle talk as none or low", () => {
    expect(["NONE", "LOW"]).toContain(scoreRelevance("The weather is fine today."));
  });
});

describe("temporal resolver", () => {
  it("resolves tomorrow evening in the user timezone", () => {
    const hit = resolveTemporal({
      text: "tomorrow evening",
      now,
      timeZone: tz,
    });
    expect(hit?.original).toBe("tomorrow evening");
    expect(hit?.precision).toBe("DAY_PART");
    expect(hit?.dueAt?.toISOString()).toBe(zonedDate(tz, 2026, 9, 22, 18, 0).toISOString());
  });

  it("does not invent a time for later", () => {
    const hit = resolveTemporal({ text: "remind me later", now, timeZone: tz });
    expect(hit?.dueAt).toBeNull();
    expect(hit?.askUser).toBe(true);
  });

  it("parses in two hours", () => {
    const hit = resolveTemporal({ text: "in two hours", now, timeZone: tz });
    expect(hit?.precision).toBe("EXACT");
    expect(hit?.dueAt?.getTime()).toBe(now.getTime() + 2 * 3_600_000);
  });
});

describe("permission", () => {
  it("never ingests a disconnected source", () => {
    expect(
      canIngest({ provider: "TELEGRAM", status: "DISCONNECTED", granted: true }),
    ).toBe(false);
    expect(
      canIngest({ provider: "TELEGRAM", status: "CONNECTED", granted: false }),
    ).toBe(false);
    expect(
      canIngest({ provider: "TELEGRAM", status: "CONNECTED", granted: true }),
    ).toBe(true);
  });

  it("always allows paste without a social connection", () => {
    expect(canIngest({ provider: "PASTE", status: "NOT_CONNECTED", granted: false })).toBe(true);
  });
});

describe("telegram normalization", () => {
  it("parses start codes", () => {
    expect(telegramStartCode("/start abc123")).toBe("abc123");
    expect(telegramStartCode("/start")).toBe("");
    expect(telegramStartCode("Yep, I'll send you the deck tomorrow.")).toBeNull();
  });

  it("normalizes a forwarded private message", () => {
    const normalized = normalizeTelegramMessage(
      {
        message_id: 44,
        date: 1758469920,
        text: "Yep, I'll send you the deck tomorrow.",
        chat: { id: 99, type: "private" },
        from: { id: 1, first_name: "Avni" },
      },
      "user-1",
    );
    expect(normalized?.provider).toBe("TELEGRAM");
    expect(normalized?.content).toContain("deck");
    expect(normalized?.permissionsContext).toBe("private_bot_chat");
  });

  it("does not normalize commands", () => {
    expect(
      normalizeTelegramMessage(
        {
          message_id: 1,
          text: "/start abc",
          chat: { id: 1, type: "private" },
        },
        "user-1",
      ),
    ).toBeNull();
  });
});

describe("whatsapp adapter", () => {
  it("normalizes official cloud-api text", () => {
    const normalized = WhatsAppAdapter.normalizeMessage(
      { id: "wamid.1", from: "1555", timestamp: "1758469920", type: "text", text: { body: "I'll call Friday." } },
      "user-1",
    );
    expect(normalized?.provider).toBe("WHATSAPP");
    expect(normalized?.content).toContain("Friday");
  });
});

describe("thread matching", () => {
  it("matches a later resolution to an open thread", () => {
    const match = bestThreadMatch(
      [
        {
          id: "t1",
          title: "send Rahul the report",
          evidence: "I'll send Rahul the report tomorrow.",
          personName: "Rahul",
        },
      ],
      detectCommitment({ text: "I sent Rahul the report.", now, timeZone: tz }),
    );
    expect(match?.certainty).toBe("STRONG");
  });
});

describe("authorization surface", () => {
  it("keeps provider webhooks public and app private", () => {
    expect(isPublicPath("/api/integrations/telegram/webhook")).toBe(true);
    expect(isPublicPath("/api/integrations/whatsapp/webhook")).toBe(true);
    expect(isPublicPath("/app/integrations")).toBe(false);
    expect(isPublicPath("/app/settings/privacy")).toBe(false);
  });
});

describe("RLS policy file", () => {
  it("covers source tables", () => {
    const sql = readFileSync(resolve(process.cwd(), "prisma/sql/rls.sql"), "utf8");
    for (const table of [
      "integration_accounts",
      "source_permissions",
      "source_conversations",
      "source_messages",
      "memory_candidates",
      "provider_events",
    ]) {
      expect(sql).toContain(`alter table ${table} enable row level security`);
    }
  });
});
