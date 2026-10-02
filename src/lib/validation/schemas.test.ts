import { describe, expect, it, beforeEach } from "vitest";
import { rateLimit, resetRateLimitForTests } from "@/lib/rate-limit";
import { guestMigrateSchema, ingestPayloadSchema, threadDetectionSchema } from "@/lib/validation/schemas";

describe("rate limit", () => {
  beforeEach(() => resetRateLimitForTests());

  it("allows then blocks", () => {
    expect(rateLimit("t", 2, 60_000).allowed).toBe(true);
    expect(rateLimit("t", 2, 60_000).allowed).toBe(true);
    expect(rateLimit("t", 2, 60_000).allowed).toBe(false);
  });
});

describe("schemas", () => {
  it("rejects empty ingest", () => {
    expect(() => ingestPayloadSchema.parse({ conversationText: "hi" })).toThrow();
  });

  it("accepts core detection shape", () => {
    const parsed = threadDetectionSchema.parse({
      is_thread: true,
      confidence: 0.5,
      type: "EXPLICIT_PROMISE",
      evidence: "I'll call you when I reach.",
      context: "travel",
      current_state: "open",
      suggested_action: "Call when you arrive.",
      needs_user_review: true,
    });
    expect(parsed.is_thread).toBe(true);
  });

  it("accepts a guest migration payload and rejects an empty one", () => {
    expect(
      guestMigrateSchema.parse({
        threads: [{ note: "I'll send the report tomorrow.", sourceKind: "TEXT" }],
        timezone: "Asia/Kolkata",
      }).threads,
    ).toHaveLength(1);
    expect(() => guestMigrateSchema.parse({ threads: [] })).toThrow();
  });
});
