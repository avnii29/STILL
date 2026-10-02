import { describe, expect, it } from "vitest";
import { excerptForRetention, messagesForRetention } from "@/lib/privacy/retention";

const messages = [
  { body: "weather looks good" },
  { body: "I'll send Rahul the deck tomorrow." },
  { body: "anyway see you" },
];

describe("retention", () => {
  it("keeps only the evidence sentence by default", () => {
    const kept = messagesForRetention(messages, ["I'll send Rahul the deck tomorrow."], "EVIDENCE_ONLY");
    expect(kept).toHaveLength(1);
    expect(kept[0]?.body).toContain("Rahul");
  });

  it("stores nothing extra when retention is NONE", () => {
    expect(messagesForRetention(messages, ["I'll send Rahul the deck tomorrow."], "NONE")).toEqual([]);
    expect(excerptForRetention("long chat", ["I'll send Rahul the deck tomorrow."], "NONE")).toBeNull();
  });

  it("keeps the full source when asked", () => {
    expect(messagesForRetention(messages, ["I'll send Rahul the deck tomorrow."], "RETAIN_SOURCE")).toHaveLength(3);
  });
});
