import { describe, expect, it } from "vitest";
import { greetingForHour, hangingCopy, quietAgo } from "@/lib/copy";

describe("copy", () => {
  it("greets by hour", () => {
    expect(greetingForHour(9)).toBe("good morning.");
    expect(greetingForHour(14)).toBe("good afternoon.");
  });

  it("does not invent a task count of zero as tasks", () => {
    expect(hangingCopy(0)).toBe("nothing is hanging right now.");
    expect(hangingCopy(4)).toBe("4 things are still hanging.");
  });

  it("speaks of weeks without scoring", () => {
    const now = new Date("2026-09-21T12:00:00Z");
    const past = new Date("2026-08-10T12:00:00Z");
    expect(quietAgo(past, now)).toContain("week");
  });
});
